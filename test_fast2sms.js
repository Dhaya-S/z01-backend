const axios = require('axios');

async function testFast2SMS() {
  try {
    const res = await axios.post("https://www.fast2sms.com/dev/otp/send", {
      mobile: "9876543210",
      otp_id: "45d6bbbddb",
    }, {
      headers: {
        authorization: "7aG1DvOlWtE9XHXk17RCTbL92lwCxHXFpne2RnmIc3eLQH0nfmlhq3pLzjOK",
      }
    });
    console.log("Response:", res.data);
  } catch (e) {
    console.error("Error:", e.response ? e.response.data : e.message);
  }
}

testFast2SMS();
