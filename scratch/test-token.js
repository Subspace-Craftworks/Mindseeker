async function testTokenEndpoint() {
  const url = "https://mindseeker-tom-kidos-projects.vercel.app/api/oauth/token";
  
  const params = new URLSearchParams();
  params.append("grant_type", "authorization_code");
  params.append("code", "dummy_code_that_will_fail_jwt_verify");
  params.append("client_id", "chatgpt");
  params.append("client_secret", "secret");

  console.log("POSTing to", url);
  console.log("Body:", params.toString());

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    const text = await res.text();
    console.log(`Response Status: ${res.status}`);
    console.log(`Response Headers:`, res.headers);
    console.log(`Response Body:`, text);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

testTokenEndpoint();
