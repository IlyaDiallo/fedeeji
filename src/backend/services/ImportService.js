const ExcelJS = require('exceljs');

class ImportService {
    /**
     * @param {Object} params
     * @param {import('./DataService')} params.dataService
     */
    constructor({ dataService }) {
        this.dataService = dataService;
    }

    /**
     * Importe des contributions depuis un fichier XLSX
     * @param {Object} params
     * @param {string} params.collectiveId
     * @param {Buffer} params.fileBuffer
     * @returns {Promise<Object>} Résultat de l'import
     */
    async importContributions({ collectiveId, fileBuffer }) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(fileBuffer);
        const worksheet = workbook.getWorksheet(1);
        const rows = this._toRowObjects(worksheet);

        const members = await this.dataService.list({
            collectiveId,
            collection: 'members'
        });

        const existingContributions = await this.dataService.list({
            collectiveId,
            collection: 'contributions'
        });

        const results = {
            total: rows.length,
            created: 0,
            skipped: 0,
            membersCreated: 0,
            errors: []
        };

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            try {
                const parsed = this._parseRow(row);

                // Recherche du membre par email
                let member = members.find(
                    m => m.email?.toLowerCase() === parsed.email.toLowerCase()
                );

                // Si pas trouvé par email, chercher par nom+prénom
                if (!member) {
                    member = members.find(
                        m => m.lastName?.toLowerCase() === parsed.lastName.toLowerCase()
                            && m.firstName?.toLowerCase() === parsed.firstName.toLowerCase()
                    );
                }

                // Créer le membre s'il n'existe pas
                if (!member) {
                    member = await this.dataService.create({
                        collectiveId,
                        collection: 'members',
                        data: {
                            lastName: parsed.lastName,
                            firstName: parsed.firstName,
                            email: parsed.email,
                            address: parsed.address,
                            postalCode: parsed.postalCode,
                            city: parsed.city,
                            country: parsed.country
                        }
                    });
                    members.push(member);
                    results.membersCreated++;
                }

                // Vérifier si la contribution existe déjà (par référence commande)
                const duplicate = existingContributions.find(
                    s => s.orderRef && parsed.orderRef && s.orderRef === parsed.orderRef
                );

                if (duplicate) {
                    results.skipped++;
                    continue;
                }

                const contribution = await this.dataService.create({
                    collectiveId,
                    collection: 'contributions',
                    data: {
                        memberId: member.id,
                        amount: parsed.amount,
                        currency: parsed.currency,
                        year: parsed.year,
                        date: parsed.date,
                        orderRef: parsed.orderRef,
                        bankRef: parsed.bankRef,
                        paymentMethod: parsed.paymentMethod
                    }
                });
                existingContributions.push(contribution);
                results.created++;
            } catch (error) {
                results.errors.push({
                    row: i + 2,
                    message: error.message
                });
            }
        }

        return results;
    }

    /**
     * Convertit les valeurs de la worksheet en objets avec en-têtes
     * @param {Worksheet} worksheet
     * @returns {Object[]} Tableau d'objets
     */
    _toRowObjects(worksheet) {
        const sheetValues = worksheet.getSheetValues();
        if (!sheetValues || !Array.isArray(sheetValues)) return [];
        const headers = sheetValues[1];
        if (!headers) return [];
        const result = [];
        for (let i = 2; i < sheetValues.length; i++) {
            const row = sheetValues[i];
            if (!row) continue;
            const obj = {};
            let hasData = false;
            headers.forEach((header, colIndex) => {
                if (header) {
                    let value = row[colIndex];
                    if (value === undefined || value === null) {
                        value = '';
                    } else if (typeof value === 'object') {
                        // Extraire le résultat des formules Excel
                        if (value instanceof Date) {
                            value = value.toISOString().split('T')[0];
                        } else if (value.result !== undefined) {
                            value = String(value.result);
                        } else {
                            value = String(value);
                        }
                    } else {
                        value = String(value);
                    }
                    obj[header] = value;
                    if (value) hasData = true;
                }
            });
            if (hasData) result.push(obj);
        }
        return result;
    }

    /**
     * Parse une ligne du fichier XLSX
     * @param {Object} row
     * @returns {Object} Données parsées
     */
    _parseRow(row) {
        const lastName = (row['Nom'] || '').trim();
        const firstName = (row['Prénom'] || '').trim();
        const email = (row['Adresse email'] || '').trim();
        const amount = Number(row['Montant']);
        const currency = (row['Devise'] || 'EUR').trim();
        const address = (row['Adresse'] || '').trim();
        const postalCode = String(row['Code postal'] || '').trim();
        const city = (row['Ville'] || '').trim();
        const country = (row['Pays'] || '').trim();
        const orderRef = (row['Référence commande'] || '').trim();
        const bankRef = (row['Référence bancaire'] || '').trim();
        const paymentMethod = (row['Moyen de paiement'] || '').trim();

        if (!lastName && !firstName && !email) {
            throw new Error('Ligne vide ou données manquantes');
        }

        if (isNaN(amount) || amount <= 0) {
            throw new Error(
                `Montant invalide pour ${lastName} ${firstName}`
            );
        }

        // Parser la date (format DD/MM/YYYY)
        const rawDate = String(row['Date'] || '').trim();
        let date = '';
        let year = new Date().getFullYear();

        if (rawDate) {
            const parts = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (parts) {
                // Convertir en format ISO YYYY-MM-DD
                date = `${parts[3]}-${parts[2]}-${parts[1]}`;
                year = Number(parts[3]);
            } else if (!isNaN(Date.parse(rawDate))) {
                // Tenter un parsing générique
                const d = new Date(rawDate);
                date = d.toISOString().split('T')[0];
                year = d.getFullYear();
            } else {
                // Date sérialisée Excel (nombre de jours depuis 1899-12-30)
                const numDate = Number(rawDate);
                if (!isNaN(numDate) && numDate > 0) {
                    const d = new Date((numDate - 25569) * 86400 * 1000);
                    date = d.toISOString().split('T')[0];
                    year = d.getFullYear();
                }
            }
        }

        return {
            lastName, firstName, email, amount, currency,
            address, postalCode, city, country,
            date, year, orderRef, bankRef, paymentMethod
        };
    }
}

module.exports = ImportService;
