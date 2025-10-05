// Simple client-side HTML include
document.addEventListener('DOMContentLoaded', async () => {
  const nodes = document.querySelectorAll('[data-include]');
  await Promise.all(Array.from(nodes).map(async node => {
    const url = node.getAttribute('data-include');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
      const text = await res.text();
      node.innerHTML = text;
    } catch (err) {
      console.error(err);
      node.innerHTML = `<!-- include failed: ${err.message} -->`;
    }
  }));
});
