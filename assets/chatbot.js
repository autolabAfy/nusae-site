/* NUSAÉ Assistant — lightweight FAQ chatbot
   Pure JS, no deps. Bilingual (EN/MS). Falls back to WhatsApp.
*/
(() => {
  const WA_NUMBER = "6597229061";
  const WA_LINK = (msg = "Hi NUSAÉ 🤍") =>
    `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;

  // ---------- Knowledge base ----------
  // Each intent: keywords (EN+MS), answer_en, answer_ms.
  const KB = [
    {
      id: "shipping_cost",
      keywords: ["shipping cost", "shipping fee", "delivery fee", "postage", "how much shipping", "free shipping", "shipping price", "cost to ship",
                 "kos hantar", "berapa hantar", "harga hantar", "penghantaran", "pos"],
      answer_en: "Shipping is <strong>free for SG &amp; MY</strong> 🤍<br>For the rest of the world, it's a flat <strong>SGD $15</strong>.",
      answer_ms: "Penghantaran <strong>percuma untuk SG &amp; MY</strong> 🤍<br>Untuk negara lain, <strong>SGD $15</strong> sahaja."
    },
    {
      id: "delivery_time",
      keywords: ["how long delivery", "delivery time", "shipping time", "when will it arrive", "when arrive", "how many days", "dispatch", "eta",
                 "berapa lama", "bila sampai", "berapa hari"],
      answer_en: "Delivery takes <strong>7–16 days</strong> after dispatch ✨<br>Most pieces are pre-order, so processing is 5–10 days before that. We'll keep you posted on WhatsApp every step of the way.",
      answer_ms: "Penghantaran ambil masa <strong>7–16 hari</strong> selepas dihantar ✨<br>Kebanyakan pieces adalah pre-order, jadi processing 5–10 hari sebelum itu. Kami akan update via WhatsApp setiap langkah."
    },
    {
      id: "tracking",
      keywords: ["tracking", "track", "track order", "tracking number", "where is my order", "order status", "parcel",
                 "jejak", "nombor tracking", "status order"],
      answer_en: "We update you directly on WhatsApp at every stage 🤍 No tracking number needed — just message us anytime and we'll check on your order for you.",
      answer_ms: "Kami akan update terus melalui WhatsApp di setiap peringkat 🤍 Tiada nombor tracking — message kami bila-bila masa untuk semak order anda."
    },
    {
      id: "customs",
      keywords: ["customs", "duties", "import tax", "tax", "duty", "cukai", "duti"],
      answer_en: "For international orders, any customs or duties are paid by the buyer. These are set by your country's customs and we have no control over them.",
      answer_ms: "Untuk order antarabangsa, sebarang cukai atau duti adalah ditanggung oleh pembeli. Ini ditetapkan oleh kastam negara anda."
    },
    {
      id: "delay",
      keywords: ["delayed", "late", "still hasn't arrived", "taking too long", "past delivery", "overdue",
                 "lambat", "lewat"],
      answer_en: "If your order is delayed past the quoted window, we'll give you <strong>20% off your next purchase</strong> as our way of saying sorry 🤍 Just message us on WhatsApp.",
      answer_ms: "Jika order anda lewat dari tempoh yang dijanjikan, kami akan beri <strong>20% off untuk pembelian seterusnya</strong> sebagai tanda maaf 🤍"
    },
    {
      id: "exchange_size",
      keywords: ["exchange size", "size exchange", "swap size", "different size", "doesn't fit", "too tight", "too loose", "too big", "too small",
                 "tukar saiz", "tak muat", "ketat", "longgar"],
      answer_en: "We don't offer size exchanges as our pieces are <strong>free size</strong>. But we're happy to help you check fit before you order — just DM us your height and usual size, and we'll advise 🤍",
      answer_ms: "Kami tidak menawarkan tukar saiz kerana pieces kami adalah <strong>free size</strong>. Tapi kami sedia membantu semak fit sebelum order — DM kami tinggi dan saiz biasa anda 🤍"
    },
    {
      id: "return_shipping",
      keywords: ["return shipping", "who pays return", "return cost", "return fee",
                 "kos pulangan", "siapa bayar pulangan"],
      answer_en: "Return shipping is paid by the buyer.",
      answer_ms: "Kos penghantaran pulangan ditanggung oleh pembeli."
    },
    {
      id: "refund",
      keywords: ["refund", "money back", "return policy", "can i return", "wani u to refund",
                 "pulangan wang", "duit balik", "polisi pulangan"],
      answer_en: "Refunds are processed within <strong>7 days</strong> — please send us a video and photos of the piece in its original packaging via WhatsApp, and we'll take care of the rest 🤍",
      answer_ms: "Pulangan wang akan diproses dalam <strong>7 hari</strong> — sila hantar video dan gambar pieces dalam pembungkusan asal melalui WhatsApp 🤍"
    },
    {
      id: "damaged",
      keywords: ["damaged", "defective", "torn", "broken", "faulty", "stained",
                 "rosak", "koyak", "kotor"],
      answer_en: "So sorry to hear that 🤍 Please send us a video and photo of the issue via WhatsApp and we'll sort it out for you right away.",
      answer_ms: "Maaf sangat dengar 🤍 Sila hantar video dan gambar kerosakan melalui WhatsApp dan kami akan uruskan segera."
    },
    {
      id: "wrong_item",
      keywords: ["wrong item", "wrong order", "received wrong", "incorrect item",
                 "salah item", "salah order", "tersilap"],
      answer_en: "Apologies for the mix-up 🤍 Please send us a video and photo of what you received via WhatsApp and we'll make it right.",
      answer_ms: "Maaf atas kesilapan 🤍 Sila hantar video dan gambar item yang diterima melalui WhatsApp dan kami akan betulkan."
    },
    {
      id: "care",
      keywords: ["wash", "care", "how to wash", "washing", "machine wash", "iron", "ironing", "care instructions",
                 "basuh", "cara basuh", "gosok", "seterika"],
      answer_en: "Please <strong>hand wash only</strong> and <strong>do not iron</strong> — the lace is delicate and these steps keep Ophelia looking soft and beautiful for longer 🤍",
      answer_ms: "Sila <strong>basuh tangan sahaja</strong> dan <strong>jangan gosok</strong> — lace ini halus, dan langkah ini membantu Ophelia kekal cantik dan lembut 🤍"
    },
    {
      id: "fabric",
      keywords: ["fabric", "material", "made of", "made from", "what is it made", "what's it made", "polyester", "cotton", "composition", "made out of",
                 "kain", "diperbuat", "buat dari", "bahan"],
      answer_en: "Our pieces are made with a <strong>polyester blend</strong> fabric — chosen for its lightweight feel, durability, and effortless everyday wear ✨<br>The fabric helps the garment hold its shape beautifully while remaining comfortable, breathable, easy to care for, and less prone to wrinkling 🤍",
      answer_ms: "Pieces kami diperbuat daripada <strong>polyester blend</strong> — dipilih kerana ringan, tahan lama, dan selesa untuk pakaian harian ✨<br>Kain ini membantu pakaian mengekalkan bentuknya, selesa, breathable, mudah dijaga, dan tidak mudah berkedut 🤍"
    },
    {
      id: "colors",
      keywords: ["colour", "color", "colours", "colors", "what colours", "available colours", "shade",
                 "warna", "warna apa"],
      answer_en: "Ophelia comes in <strong>white, black, beige, and grey</strong> 🤍 More colours are coming in our next launches ✨",
      answer_ms: "Ophelia tersedia dalam warna <strong>putih, hitam, beige, dan kelabu</strong> 🤍 Lebih banyak warna akan dilancarkan tidak lama lagi ✨"
    },
    {
      id: "restock",
      keywords: ["restock", "sold out", "out of stock", "back in stock", "waitlist", "available again", "pre-order", "preorder",
                 "habis stok", "ada lagi", "bila ada"],
      answer_en: "Yes — we restock! 🤍 Just <a href=\"" + WA_LINK("Hi NUSAÉ, I'd like to pre-order Ophelia 🤍") + "\" target=\"_blank\" rel=\"noopener\">message us on WhatsApp</a> to pre-order and we'll let you know when it arrives.",
      answer_ms: "Ya — kami akan restock! 🤍 <a href=\"" + WA_LINK("Hi NUSAÉ, saya nak pre-order Ophelia 🤍") + "\" target=\"_blank\" rel=\"noopener\">WhatsApp kami</a> untuk pre-order."
    },
    {
      id: "layering",
      keywords: ["wear under", "wear underneath", "layer", "what to wear", "pair with", "style with", "underneath",
                 "pakai dalam", "pakai bawah"],
      answer_en: "Ophelia is designed as an outerwear piece — easy to layer over almost anything 🤍 Most love it with:<br>• tank tops<br>• inner slips<br>• basic dresses<br>• camis<br>• long sleeves<br>• even casual tees for a more relaxed look ✨",
      answer_ms: "Ophelia direka sebagai outerwear — mudah untuk layer atas hampir apa sahaja 🤍 Ramai pakai dengan tank tops, inner slips, basic dresses, camis, long sleeves, atau casual tees ✨"
    },
    {
      id: "fit",
      keywords: ["fit", "how does it fit", "size", "free size", "length", "neckline", "sleeve", "modesty", "modest", "coverage",
                 "saiz", "panjang"],
      answer_en: "Ophelia is a <strong>relaxed free-size outer layer</strong> 🤍<br>• Long sleeves for arm coverage<br>• Modest neckline that layers easily over inner tops<br>• Flowy longer-length silhouette<br>On average heights, it falls around the hips/thigh area. DM us your height and we'll gladly advise ✨",
      answer_ms: "Ophelia adalah <strong>outer layer free-size yang relaxed</strong> 🤍 Lengan panjang, neckline modest, silhouette panjang dan flowy. Untuk ketinggian biasa, jatuh sekitar paras pinggul/peha. DM tinggi anda untuk advice ✨"
    },
    {
      id: "payment_methods",
      keywords: ["payment method", "how to pay", "what payment", "card", "credit card", "debit card", "paynow", "duitnow", "hitpay",
                 "cara bayar", "kaedah bayaran"],
      answer_en: "We accept <strong>credit/debit cards and PayNow</strong> via our secure HitPay checkout 🤍",
      answer_ms: "Kami terima <strong>kad kredit/debit dan PayNow</strong> melalui HitPay checkout yang selamat 🤍"
    },
    {
      id: "currency",
      keywords: ["currency", "what currency", "sgd", "usd", "myr", "ringgit",
                 "matawang", "mata wang"],
      answer_en: "All orders are charged in <strong>SGD only</strong>. Your bank or card will handle the conversion automatically.",
      answer_ms: "Semua order dicaj dalam <strong>SGD sahaja</strong>. Bank atau kad anda akan handle pertukaran secara automatik."
    },
    {
      id: "bnpl",
      keywords: ["atome", "shopback", "paylater", "installment", "instalment", "buy now pay later",
                 "ansuran", "bayar nanti"],
      answer_en: "We don't offer buy-now-pay-later at the moment, but we'd be happy to help you any other way 🤍",
      answer_ms: "Kami tidak menawarkan buy-now-pay-later buat masa ini, tetapi kami sedia membantu dengan cara lain 🤍"
    },
    {
      id: "discount",
      keywords: ["discount", "promo", "promo code", "voucher", "coupon", "sale", "deal", "first time",
                 "diskaun", "kod promo"],
      answer_en: "No active promo codes at the moment, but follow <a href=\"https://instagram.com/shopnusae\" target=\"_blank\" rel=\"noopener\">@shopnusae</a> on IG to be the first to know about launches and special drops 🤍",
      answer_ms: "Tiada kod promo aktif buat masa ini, tetapi follow <a href=\"https://instagram.com/shopnusae\" target=\"_blank\" rel=\"noopener\">@shopnusae</a> di IG untuk update terkini 🤍"
    },
    {
      id: "cancel",
      keywords: ["cancel", "cancellation", "change order", "modify order", "wrong size ordered",
                 "batal", "tukar order"],
      answer_en: "Once an order is placed we're unable to cancel it 🤍 If something feels off, message us right away on WhatsApp and we'll see what we can do.",
      answer_ms: "Setelah order dibuat, kami tidak dapat membatalkannya 🤍 Jika ada apa-apa, terus WhatsApp kami dan kami akan cuba bantu."
    },
    {
      id: "wholesale",
      keywords: ["bulk", "wholesale", "bulk order", "large order", "many pieces", "reseller",
                 "borong", "pukal"],
      answer_en: "Bulk and wholesale orders welcome — <strong>minimum 10 pieces</strong>. Just <a href=\"" + WA_LINK("Hi NUSAÉ, I'd like to discuss a bulk order 🤍") + "\" target=\"_blank\" rel=\"noopener\">message us on WhatsApp</a> to discuss.",
      answer_ms: "Order pukal dialu-alukan — <strong>minimum 10 pieces</strong>. <a href=\"" + WA_LINK("Hi NUSAÉ, saya nak bincang bulk order 🤍") + "\" target=\"_blank\" rel=\"noopener\">WhatsApp kami</a> untuk berbincang."
    },
    {
      id: "giftwrap",
      keywords: ["gift wrap", "gift wrapping", "gift", "handwritten note", "card", "present", "wrapping",
                 "hadiah", "bungkus hadiah"],
      answer_en: "Yes — let us know if you'd like gift wrapping or a handwritten note when you order, and we'll arrange it for you 🤍",
      answer_ms: "Ya — beritahu kami jika anda mahu gift wrap atau nota tulisan tangan, dan kami akan uruskan 🤍"
    },
    {
      id: "price",
      keywords: ["price", "how much", "cost", "how much is", "ophelia price",
                 "harga", "berapa harga"],
      answer_en: "Ophelia is <strong>SGD $47</strong>. Free shipping for SG &amp; MY 🤍",
      answer_ms: "Ophelia berharga <strong>SGD $47</strong>. Penghantaran percuma untuk SG &amp; MY 🤍"
    },
    {
      id: "how_to_order",
      keywords: ["how to order", "how do i order", "place order", "buy", "checkout", "purchase",
                 "cara order", "cara beli"],
      answer_en: "Two ways 🤍<br>1. Use the <strong>Order now</strong> button on the page (secure HitPay checkout — card or PayNow)<br>2. Or <a href=\"" + WA_LINK() + "\" target=\"_blank\" rel=\"noopener\">message us on WhatsApp</a> and we'll handle it for you.",
      answer_ms: "Dua cara 🤍<br>1. Guna butang <strong>Order now</strong> di laman ini (HitPay checkout)<br>2. Atau <a href=\"" + WA_LINK() + "\" target=\"_blank\" rel=\"noopener\">WhatsApp kami</a> dan kami uruskan."
    },
    {
      id: "contact",
      keywords: ["contact", "human", "speak to someone", "talk to someone", "support", "help me",
                 "hubungi", "cakap manusia"],
      answer_en: "Of course 🤍 <a href=\"" + WA_LINK() + "\" target=\"_blank\" rel=\"noopener\">Message us on WhatsApp</a> and we'll be right with you.",
      answer_ms: "Sudah tentu 🤍 <a href=\"" + WA_LINK() + "\" target=\"_blank\" rel=\"noopener\">WhatsApp kami</a> dan kami akan layan anda segera."
    },
    {
      id: "greeting",
      keywords: ["hi", "hello", "hey", "salam", "assalam", "halo", "helo"],
      answer_en: "Hi love 🤍 Welcome to NUSAÉ. Ask me anything about Ophelia, shipping, sizing, or how to order ✨",
      answer_ms: "Hi sayang 🤍 Selamat datang ke NUSAÉ. Tanya saya tentang Ophelia, penghantaran, saiz, atau cara order ✨"
    },
    {
      id: "thanks",
      keywords: ["thank", "thanks", "ty", "terima kasih", "tq"],
      answer_en: "You're so welcome 🤍 We're here whenever you need us.",
      answer_ms: "Sama-sama 🤍 Kami ada bila-bila masa anda perlukan."
    }
  ];

  const SUGGESTED = [
    { en: "How much is Ophelia?", ms: "Berapa harga Ophelia?" },
    { en: "Shipping cost & delivery time?", ms: "Kos & masa penghantaran?" },
    { en: "How do I wash it?", ms: "Cara basuh?" },
    { en: "What colours are available?", ms: "Ada warna apa?" },
    { en: "How do I order?", ms: "Cara order?" }
  ];

  const OFFLINE_MSG_EN = "Hi love 🤍 Thanks for messaging NUSAÉ ✨ Our team is currently offline, but we'll get back to you as soon as possible once we're back online. In the meantime, feel free to browse our collection or leave your questions here — we can't wait to assist you 🤍";
  const FALLBACK_EN = "We're not quite sure on that one 🤍 <a href=\"" + WA_LINK() + "\" target=\"_blank\" rel=\"noopener\">Message us on WhatsApp</a> and we'll help you right away.";
  const FALLBACK_MS = "Kami tidak pasti tentang itu 🤍 <a href=\"" + WA_LINK() + "\" target=\"_blank\" rel=\"noopener\">WhatsApp kami</a> dan kami akan bantu segera.";

  // ---------- Language detection ----------
  const MS_MARKERS = [
    "saya", "awak", "kamu", "berapa", "bila", "macam mana", "kenapa", "boleh",
    "tak", "tidak", "nak", "dengan", "untuk", "yang", "ini", "itu", "tu", "ni",
    "kos", "harga", "hantar", "basuh", "warna", "saiz", "tukar", "batal", "borong",
    "selamat", "terima kasih", "tolong", "sila", "bagi", "ada", "mana", "siapa"
  ];
  function detectLang(text) {
    const t = text.toLowerCase();
    let hits = 0;
    for (const m of MS_MARKERS) {
      const re = new RegExp("\\b" + m.replace(/ /g, "\\s") + "\\b");
      if (re.test(t)) hits++;
      if (hits >= 2) return "ms";
    }
    return "en";
  }

  // ---------- Intent matching ----------
  function score(input, intent) {
    const t = input.toLowerCase();
    let s = 0;
    for (const kw of intent.keywords) {
      if (t.includes(kw)) s += kw.length; // longer match = higher signal
    }
    return s;
  }
  function matchIntent(input) {
    let best = null, bestScore = 0;
    for (const intent of KB) {
      const s = score(input, intent);
      if (s > bestScore) { bestScore = s; best = intent; }
    }
    return bestScore > 0 ? best : null;
  }

  // ---------- DOM ----------
  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null) continue;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return e;
  }

  function build() {
    // Bubble
    const bubble = el("button", {
      class: "nusae-chat-bubble",
      "aria-label": "Open chat",
      type: "button"
    });
    bubble.innerHTML = `
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/>
      </svg>
      <span class="nusae-chat-dot" aria-hidden="true"></span>
    `;

    // Panel
    const panel = el("div", { class: "nusae-chat-panel", role: "dialog", "aria-label": "NUSAÉ Assistant", "aria-hidden": "true" });
    panel.innerHTML = `
      <div class="nusae-chat-head">
        <div class="nusae-chat-id">
          <div class="nusae-chat-avatar" aria-hidden="true">N</div>
          <div>
            <div class="nusae-chat-name">NUSAÉ Assistant</div>
            <div class="nusae-chat-sub">Usually replies in a moment 🤍</div>
          </div>
        </div>
        <button class="nusae-chat-close" type="button" aria-label="Close chat">×</button>
      </div>
      <div class="nusae-chat-body" id="nusae-chat-body" role="log" aria-live="polite"></div>
      <div class="nusae-chat-suggested" id="nusae-chat-suggested"></div>
      <form class="nusae-chat-form" id="nusae-chat-form">
        <input type="text" id="nusae-chat-input" placeholder="Ask about Ophelia, shipping, fit…" autocomplete="off" maxlength="300" />
        <button type="submit" aria-label="Send">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4 20-7Z"/></svg>
        </button>
      </form>
      <a class="nusae-chat-wa" href="${WA_LINK()}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.821 11.821 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
        Message us on WhatsApp
      </a>
    `;

    document.body.appendChild(bubble);
    document.body.appendChild(panel);

    const body = panel.querySelector("#nusae-chat-body");
    const sugWrap = panel.querySelector("#nusae-chat-suggested");
    const form = panel.querySelector("#nusae-chat-form");
    const input = panel.querySelector("#nusae-chat-input");
    const closeBtn = panel.querySelector(".nusae-chat-close");

    let lang = "en"; // updated per user message
    let opened = false;

    function appendBubble(role, html) {
      const msg = el("div", { class: "nusae-chat-msg " + role });
      msg.innerHTML = html;
      body.appendChild(msg);
      body.scrollTop = body.scrollHeight;
      return msg;
    }
    function showTyping() {
      const t = el("div", { class: "nusae-chat-msg bot nusae-chat-typing" });
      t.innerHTML = "<span></span><span></span><span></span>";
      body.appendChild(t);
      body.scrollTop = body.scrollHeight;
      return t;
    }

    function renderSuggested() {
      sugWrap.innerHTML = "";
      SUGGESTED.forEach(s => {
        const text = lang === "ms" ? s.ms : s.en;
        const chip = el("button", { type: "button", class: "nusae-chat-chip" }, text);
        chip.addEventListener("click", () => {
          input.value = text;
          form.dispatchEvent(new Event("submit", { cancelable: true }));
        });
        sugWrap.appendChild(chip);
      });
    }

    function answer(userInput) {
      lang = detectLang(userInput);
      const intent = matchIntent(userInput);
      const reply = intent
        ? (lang === "ms" ? intent.answer_ms : intent.answer_en)
        : (lang === "ms" ? FALLBACK_MS : FALLBACK_EN);
      return reply;
    }

    function open() {
      if (opened) return;
      opened = true;
      panel.classList.add("open");
      panel.setAttribute("aria-hidden", "false");
      bubble.classList.add("hidden");
      if (!body.dataset.greeted) {
        body.dataset.greeted = "1";
        appendBubble("bot", "Hi love 🤍 I'm the <strong>NUSAÉ Assistant</strong>. Ask me anything about Ophelia, shipping, sizing, or how to order ✨");
        renderSuggested();
      }
      setTimeout(() => input.focus(), 200);
    }
    function close() {
      opened = false;
      panel.classList.remove("open");
      panel.setAttribute("aria-hidden", "true");
      bubble.classList.remove("hidden");
    }

    bubble.addEventListener("click", open);
    closeBtn.addEventListener("click", close);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) return;
      appendBubble("user", v.replace(/[<>]/g, ""));
      input.value = "";
      const reply = answer(v);
      const typing = showTyping();
      setTimeout(() => {
        typing.remove();
        appendBubble("bot", reply);
        renderSuggested();
      }, 500 + Math.random() * 400);
    });

    // Esc closes
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && opened) close();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
