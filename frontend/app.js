const form = document.getElementById('booking');
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    const data = new FormData(form);
    const response = await fetch('/api/bookings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: data.get('name'), email: data.get('email'), slot: new Date(data.get('slot')).toISOString() }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Booking failed');
    document.getElementById('result').textContent = `Booked! Reference #${result.id}`;
    form.reset();
  } catch (error) {
    document.getElementById('result').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
