# 🔧 WhatsApp Message Setup Guide

## समस्याएं और समाधान (Issues & Solutions)

### 1️⃣ **Users को Phone Number नहीं है**
यह सबसे आम समस्या है। जब task assign करते हैं, तो system को pता होना चाहिए कि किस number पर message भेजना है।

#### ✅ समाधान:
- **Database में phone field add करें** या
- **Manually update करें**:
```javascript
// mongosh में चलाएं
db.users.updateOne(
  { email: "user@example.com" },
  { $set: { phone: "919876543210" } }  // 91 के साथ country code लिखें
)
```

### 2️⃣ **WhatsApp Connection नहीं है (Baileys Mode)**
यदि `WA_MODE=baileys` use कर रहे हैं, तो device को connect करना होगा।

#### ✅ समाधान:
```bash
# Terminal में चलाएं:
npm run dev:baileys
# या
set WA_MODE=baileys && node server.js
```
फिर `/qr` page खोलें और QR code scan करें:
- http://localhost:8000/qr (अपना port लगाएं)

### 3️⃣ **Cloud API Credentials नहीं हैं**
यदि `WhatsApp Cloud API` use करना चाहते हैं:

#### ✅ समाधान:
`.env` file में add करें:
```
WA_MODE=cloud
WHATSAPP_TOKEN=your_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_id_here
```

---

## 🔍 Debugging Steps

### Step 1: Check WA Mode
```bash
curl http://localhost:8000/api/health | grep waMode
```
Output में देखें:
- `"waMode": "baileys"` ✅ (Baileys mode चल रहा है)
- `"waMode": "cloud"` ✅ (Cloud API चल रहा है)

### Step 2: Check Logs जब Task Create करते हैं

Terminal में ये messages देखें:
```
[createTask] Task created with ID: 12345...
[createTask] initiating notifications...
[notifyTaskCreate] Task created: My Task Name, Assignees: 1
[notifyTaskCreate] Sending WhatsApp to 919876543210 (User Name)
[whatsapp.baileys] Sending message to 919876543210
[whatsapp.baileys] ✅ Message sent successfully to 919876543210
```

### Step 3: अगर Errors दिखते हैं

**Error: "Assignee has no phone number"**
→ User का phone number add करें

**Error: "Baileys not initialized"**
→ `/qr` page खोलें और QR scan करें

**Error: "Cloud API env missing"**
→ `.env` में WHATSAPP_TOKEN और WHATSAPP_PHONE_NUMBER_ID add करें

---

## ✨ How to Add Phone Number to Users

### Option 1: MongoDB से directly update करें
```javascript
// mongosh में
use task_manager  // अपना DB name लगाएं
db.users.updateMany({}, { $set: { phone: "919876543210" } })
// या specific user के लिए:
db.users.updateOne(
  { email: "john@example.com" },
  { $set: { phone: "919876543210" } }
)
```

### Option 2: API Endpoint से करें (अगर UI support हो)
```bash
curl -X PUT http://localhost:8000/api/users/123 \
  -H "Content-Type: application/json" \
  -d '{"phone": "919876543210"}'
```

---

## 📝 Phone Number Format

**सही format (Correct):**
- `919876543210` ✅
- `+919876543210` ✅  
- `91-9876543210` ❌ (symbols नहीं चल पाएंगे)

Country codes:
- 🇮🇳 India: `91`
- 🇺🇸 USA: `1`
- 🇬🇧 UK: `44`

---

## ✅ Testing

जब सब कुछ setup हो जाए:

1. User dashboard में जाएं
2. एक नया task create करें और किसी user को assign करें
3. **Server logs चेक करें** - `[whatsapp.baileys] ✅ Message sent successfully` देखना चाहिए
4. WhatsApp पर message प्राप्त होगा ✅

---

## 🚀 क्या काम करता है?

अब automatically message जाएगा जब:
1. ✅ नया task create हो
2. ✅ Task assign किया जाए
3. ✅ Assignee के पास phone number हो
4. ✅ WhatsApp connection established हो (Baileys/Cloud)

---

## 📞 Support

अगर अभी भी काम नहीं हो रहा:

1. Logs में error message note करें
2. Check करें कि:
   - ✓ Phone number format सही है?
   - ✓ User का phone field DB में exist करता है?
   - ✓ WhatsApp connected है?
   - ✓ Environment variables सही हैं?

