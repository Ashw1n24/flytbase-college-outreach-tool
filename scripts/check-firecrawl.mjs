const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:8080').replace(/\/$/, '');
const url = `${base}/api/firecrawl/+server`;
let lastText = '';
let lastStatus = -1;
try {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com', formats: ['markdown'], onlyMainContent: true }),
    redirect: 'manual',
  });
  lastStatus = res.status;
  lastText = await res.text();
} catch (err) {
  lastStatus = 'network_error';
  lastText = String(err);
}
if (lastStatus === -1) {
  console.log('STATUS: network_error, BODY:', lastText);
} else {
  console.log(`STATUS: ${lastStatus}, BODY:`);
}
console.log(lastText);
