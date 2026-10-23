// End-to-end test of the whole system through the API Gateway.
//   node scripts/test-flow.mjs              (default http://localhost:8080)
//   BASE_URL=http://localhost:8080 node scripts/test-flow.mjs
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function waitForStatus(orderId, token) {
  for (let i = 0; i < 20; i++) {
    const order = await call('GET', `/api/orders/${orderId}`, { token });
    if (order.status !== 'PENDING') return order;
    await sleep(500);
  }
  throw new Error('Order still PENDING after 10s — check payment-service logs');
}

const step = (n, msg) => console.log(`\n[${n}] ${msg}`);

step(1, 'Health of all services');
console.log(await call('GET', '/health/services'));

step(2, 'Register a new user (-> user.registered -> welcome email)');
const email = `john.${Date.now()}@example.com`;
const { token, user } = await call('POST', '/api/users/register', {
  body: { name: 'John Doe', email, password: 'Secret@123' },
});
console.log('user:', user.email, 'id:', user._id);

step(3, 'List products (public endpoint)');
const { items: products } = await call('GET', '/api/products');
products.forEach((p) => console.log(` - ${p.name.padEnd(22)} $${p.price}  stock=${p.stock}  id=${p._id}`));
const cheap = products.find((p) => p.sku === 'KB-001');
const expensive = products.find((p) => p.sku === 'LP-001');

step(4, 'Place an order that will be PAID');
let order = await call('POST', '/api/orders', { token, body: { items: [{ productId: cheap._id, quantity: 2 }] } });
console.log('created:', order._id, order.status, '$' + order.totalAmount);
order = await waitForStatus(order._id, token);
console.log('final  :', order.status);

step(5, 'Place an order that will FAIL payment (amount > card limit) -> stock released');
let failed = await call('POST', '/api/orders', { token, body: { items: [{ productId: expensive._id, quantity: 1 }] } });
failed = await waitForStatus(failed._id, token);
console.log('final  :', failed.status, '-', failed.cancelReason);
await sleep(1000);
const laptop = await call('GET', `/api/products/${expensive._id}`);
console.log(`laptop stock back to ${laptop.stock} (was ${expensive.stock})`);

step(6, 'Payments for this user');
(await call('GET', '/api/payments', { token })).forEach((p) =>
  console.log(` - order ${p.orderId}  ${p.status}  $${p.amount}`)
);

step(7, 'Notifications (also visible as emails in Mailpit)');
await sleep(1500);
const { items: notes, unread } = await call('GET', '/api/notifications', { token });
notes.forEach((n) => console.log(` - [${n.emailStatus}] ${n.title}`));
console.log('unread:', unread);

step(8, 'Security check: protected route without a token');
try {
  await call('GET', '/api/orders');
} catch (e) {
  console.log('blocked as expected ->', e.message);
}

console.log('\nAll good! Open the email inbox at http://localhost:8025');
