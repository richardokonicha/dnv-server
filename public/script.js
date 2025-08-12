document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('checkoutBtn');
  if (!button) return;

  button.addEventListener('click', async () => {
    try {
      // Collect your data from inputs or variables as needed
      const villaName = '5BR Paramount Haven';    // Replace with actual dynamic data
      const villaSlug = 'tfv-c5-br-bf';           // Replace with actual dynamic data
      const baseRate = '898';                      // Replace with actual dynamic data
      const cleaningFee = '245';                   // Replace with actual dynamic data
      const icalFeed = '';                         // Replace if you have this
      const checkIn = '2025-08-12';                // Replace with dynamic date input
      const checkOut = '2025-08-14';               // Replace with dynamic date input

      const payload = {
        villaName,
        villaSlug,
        baseRate,
        cleaningFee,
        icalFeed,
        checkIn,
        checkOut
      };

      const response = await fetch('/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Unknown error');

      window.location = data.url; // redirect to checkout URL

    } catch (e) {
      console.error(e);
      alert('Failed to create checkout session. Check console for details.');
    }
  });
});
