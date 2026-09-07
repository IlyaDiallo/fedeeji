// Original Feddeeji drawings, using Tabler's 24×24 stroke conventions.
// Kept in the existing logical catalogue for recipe compatibility; these are
// local additions, not upstream Tabler icons.
const stroke = body => ({
    body: `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</g>`
});

module.exports = {
    'feddeeji-sink': stroke(
        '<path d="M3 11h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z"/>'
        + '<path d="M12 11V5a2 2 0 0 1 4 0v1M9 18v3h6v-3M7 8v3M17 8v3"/>'
    ),
    'feddeeji-faucet': stroke(
        '<path d="M4 10h9a5 5 0 0 1 5 5v1h-4v-1a1 1 0 0 0-1-1H4M4 8v8M10 10V6M7 6h6M10 4v2"/>'
        + '<path d="M16 18s-2 2-2 3a2 2 0 0 0 4 0c0-1-2-3-2-3"/>'
    ),
    'feddeeji-shower': stroke(
        '<path d="M5 21V6a3 3 0 0 1 6 0v1M8 11a3 4 0 0 1 6 0zM8 15v1M11 15v2M14 15v1M8 19v1M14 19v1"/>'
    )
};
