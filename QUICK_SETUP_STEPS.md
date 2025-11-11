# Step-by-Step: WhatsApp Setup करें

## समस्या
Task create करने के बाद WhatsApp पर automatically message नहीं जा रहे।

## समाधान - 5 आसान Steps

---

## ✅ Step 1: Database में Phone Numbers Add करें (सबसे जरूरी!)

### Option A: MongoDB Shell से करें

```bash
# 1. mongosh खोलें:
mongosh

# 2. अपना database select करें:
use one_dev_task

# 3. Users के phone numbers add करें:
db.users.updateOne(
  { email: "user@example.com" },  // अपना email लगाएं
  { $set: { phone: "919876543210" } }  // अपना phone लगाएं
)
```

**Verify करने के लिए:**
```javascript
db.users.find({}, { name: 1, email: 1, phone: 1 }).pretty()
```

Expected output:
```
{
  _id: ObjectId(...),
  name: "John Doe",
  email: "john@example.com",
  phone: "919876543210"
}
```

### Option B: सभी Users को एक ही number दें (Testing के लिए)

```javascript
db.users.updateMany({}, { $set: { phone: "919876543210" } })
```

---

## ✅ Step 2: Environment Variable Set करें

### Baileys Mode (Free - सबसे आसान)

**Windows PowerShell में:**
```powershell
# Option 1: Single command में
$env:WA_MODE="baileys"; npm run dev

# Option 2: या पहले set करें फिर run करें
$env:WA_MODE="baileys"
npm run dev:baileys
```

**या `.env` file में add करें:**
```
WA_MODE=baileys
```

फिर:
```bash
npm run dev
```

---

## ✅ Step 3: QR Code Scan करें (Baileys के लिए)

1. Server को `WA_MODE=baileys` के साथ start करें
2. Browser में खोलें: `http://localhost:8000/qr`
3. आपके **WhatsApp phone** में जाएं:
   - **Settings** → **Linked devices** → **Link a device**
4. Phone के camera से **QR code को scan करें**
5. Wait करें... device connect होगा ✅

**Terminal में देखेंगे:**
```
[wa] connected
```

---

## ✅ Step 4: Test करें

### Test Script चलाएं:

```bash
# backend folder में
cd backend
node test-whatsapp.js
```

यह output देना चाहिए:
```
✅ Database connected
✅ Some users have phone numbers
✅ Baileys is configured
✅ Everything looks good!
```

### या Manually Task Create करें:

1. **Frontend में जाएं** या **API call करें**
2. **नया Task बनाएं** और **assignee select करें**
3. **Save करें**
4. **Terminal में logs देखें:**

```
[createTask] Task created with ID: ...
[notifyTaskCreate] Task created: My Task, Assignees: 1
[notifyTaskCreate] Sending WhatsApp to 919876543210 (John Doe)
[whatsapp.baileys] ✅ Message sent successfully to 919876543210
```

5. **अपने WhatsApp पर message देखें** ✅

---

## 🔧 Troubleshooting

### Problem 1: "Assignee has no phone number"

```
[notifyTaskCreate] Assignee John Doe has no phone number
```

**Solution:**
```javascript
db.users.updateOne(
  { email: "john@example.com" },
  { $set: { phone: "919876543210" } }
)
```

---

### Problem 2: "Baileys not initialized"

```
[whatsapp.baileys] ❌ Error: Baileys not initialized
```

**Solution:**
1. Server को `/qr` से QR code scan करके restart करें
2. या पहले से QR scan करके पहचान दें कि device connected है

---

### Problem 3: Message send हो रहा पर receive नहीं हो रहा

**Check करें:**
1. Phone number format सही है? `919876543210` (11 digits)
2. Country code सही है? (India = 91)
3. WhatsApp device **active** है और **internet connected** है?

---

## 📱 Phone Number Format

| Format | Example | ✅/❌ |
|--------|---------|-------|
| Country code + number | 919876543210 | ✅ |
| With plus sign | +919876543210 | ✅ |
| With spaces | 91 9876 543210 | ✅ (सिस्टम clean करेगा) |
| Wrong format | 9876543210 | ❌ (country code नहीं है) |
| With dashes | 91-9876-543210 | ❌ (symbols नहीं चल सकते) |

**Country Codes:**
- 🇮🇳 India: 91
- 🇵🇰 Pakistan: 92
- 🇺🇸 USA: 1
- 🇬🇧 UK: 44

---

## ✨ Success Indicators

### ✅ अगर सब काम कर रहा है:

1. **Task create करते हैं** → Message तुरंत भेजा जाता है
2. **Terminal में logs** → Clear success messages
3. **WhatsApp में** → Message आता है (~1 second में)
4. **Message format** अच्छा है:
   ```
   👋 *Dear John Doe*,
   
   You have been *assigned a new task*.
   
   *Category* - Projects
   *Task* - Complete Report
   *Priority* - High
   *Due Date* - 25-Dec-25 05:30 PM
   
   🔗 *Open App* - http://localhost:3000
   ```

---

## 🎯 Complete Checklist

```
Database:
☐ Users के phone numbers हैं? (db.users.findOne())
☐ Phone format सही है? (919876543210)

Environment:
☐ WA_MODE=baileys set किया?
☐ Server restart किया?

WhatsApp:
☐ QR code scan किया? (http://localhost:8000/qr)
☐ Terminal में "[wa] connected" दिखा?

Testing:
☐ test-whatsapp.js ✅ दिखा?
☐ Task create किया और assign किया?
☐ Terminal में success logs दिखे?
☐ WhatsApp पर message आया?
```

---

## 🚀 Advanced: Cloud API Setup (Optional)

अगर **Baileys** की जगह **Official WhatsApp Cloud API** use करना चाहते हो:

```bash
# .env file में:
WA_MODE=cloud
WHATSAPP_TOKEN=your_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_id_here
WHATSAPP_API_VERSION=v21.0
WHATSAPP_LANG=en
```

फिर restart करो:
```bash
npm run dev
```

---

## 📞 अगर अभी भी काम नहीं हो रहा

1. **Logs को पूरा पढ़ो** - error message में solution है
2. **test-whatsapp.js चलाओ** - यह बताएगा कि क्या गलत है
3. **Phone numbers confirm करो** - सबसे common problem
4. **QR code re-scan करो** - Baileys को re-connect करने के लिए
5. **Server restart करो** - नए changes के लिए

---

## ✅ Final Check

**Terminal में यह command चलाओ:**
```bash
curl http://localhost:8000/api/health
```

Output में ये देखना चाहिए:
```json
{
  "ok": true,
  "waMode": "baileys",  // या "cloud"
  "time": "2025-11-11T..."
}
```

If `waMode` सही दिख रहा है → सब setup हो गया! 🎉

---

**अब आपके सभी tasks के लिए automatically WhatsApp messages जाएंगे!** ✅
