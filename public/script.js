document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('checkoutBtn');
  if (!button) return;

  button.addEventListener('click', async () => {
    try {
      const response = await fetch('/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          villaName: 'Sample Villa',
          items: [
            { name: '3 nights × $150', amountInCents: 45000, quantity: 1 },
            { name: 'Cleaning Fee', amountInCents: 5000, quantity: 1 },
          ],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unknown error');
      window.location = data.url;
    } catch (e) {
      console.error(e);
      alert('Failed to create checkout session. Check console for details.');
    }
  });
});


