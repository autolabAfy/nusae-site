var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/admin/payment-status.js
async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ ok: false, error: "invalid json" }, 400);
  }
  if (!body.secret || body.secret !== env.GAS_SHARED_SECRET) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  if (!body.payment_request_id) {
    return json({ ok: false, error: "payment_request_id required" }, 400);
  }
  if (!env.HITPAY_API_KEY) {
    return json({ ok: false, error: "HITPAY_API_KEY not configured" }, 500);
  }
  const url = `https://api.hit-pay.com/v1/payment-requests/${encodeURIComponent(body.payment_request_id)}`;
  let res, data;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        "X-BUSINESS-API-KEY": env.HITPAY_API_KEY,
        "X-Requested-With": "XMLHttpRequest"
      }
    });
    data = await res.json();
  } catch (err) {
    return json({ ok: false, error: "hitpay unreachable", message: String(err && err.message || err) }, 502);
  }
  if (!res.ok) {
    return json({ ok: false, error: "hitpay error", status: res.status, detail: data }, 502);
  }
  return json({
    ok: true,
    status: data.status || "unknown",
    amount: data.amount,
    refunded_amount: data.refunded_amount || "0.00",
    currency: data.currency,
    payment_url: data.url || null
  });
}
__name(onRequestPost, "onRequestPost");
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(json, "json");

// api/admin/recovery-link.js
var HITPAY_ENDPOINT = "https://api.hit-pay.com/v1/payment-requests";
async function onRequestPost2({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json2({ ok: false, error: "invalid json" }, 400);
  }
  if (!body.secret || body.secret !== env.GAS_SHARED_SECRET) {
    return json2({ ok: false, error: "unauthorized" }, 401);
  }
  if (!env.HITPAY_API_KEY) {
    return json2({ ok: false, error: "HITPAY_API_KEY not configured" }, 500);
  }
  if (!body.order_id || !body.email || !body.amount_sgd) {
    return json2({ ok: false, error: "order_id, email, amount_sgd required" }, 400);
  }
  const origin = new URL(request.url).origin;
  const itemsSummary = body.items_summary || "NUSAE Ophelia";
  const hitpayBody = {
    amount: Number(body.amount_sgd).toFixed(2),
    currency: "SGD",
    email: body.email,
    name: (body.name || "").trim(),
    phone: body.phone || "",
    purpose: `NUSAE Ophelia - ${itemsSummary}`,
    reference_number: body.order_id,
    payment_methods: ["paynow_online", "card"],
    redirect_url: `${origin}/thank-you?order=${encodeURIComponent(body.order_id)}`,
    webhook: `${origin}/api/hitpay-webhook`,
    send_email: false
  };
  let res, text;
  try {
    res = await fetch(HITPAY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "X-BUSINESS-API-KEY": env.HITPAY_API_KEY
      },
      body: JSON.stringify(hitpayBody)
    });
    text = await res.text();
  } catch (err) {
    return json2({ ok: false, error: "hitpay unreachable", message: String(err && err.message || err) }, 502);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = {};
  }
  if (!res.ok || !data.url) {
    return json2({ ok: false, error: "hitpay create failed", status: res.status, detail: data }, 502);
  }
  return json2({ ok: true, url: data.url, id: data.id });
}
__name(onRequestPost2, "onRequestPost");
function json2(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(json2, "json");

// api/checkout.js
var PRICE_SGD = 35;
var HITPAY_ENDPOINT2 = "https://api.hit-pay.com/v1/payment-requests";
var ALLOWED_COLOURS = /* @__PURE__ */ new Set(["white", "beige", "grey", "black"]);
async function onRequestPost3(context) {
  try {
    return await handle(context);
  } catch (err) {
    return json3({ error: "Server error", message: String(err && err.message || err), stack: String(err && err.stack || "") }, 500);
  }
}
__name(onRequestPost3, "onRequestPost");
async function handle({ request, env }) {
  if (!env.HITPAY_API_KEY) return json3({ error: "Missing HITPAY_API_KEY env var" }, 500);
  let payload;
  try {
    payload = await request.json();
  } catch (_) {
    return json3({ error: "Invalid JSON" }, 400);
  }
  const v = validate(payload);
  if (v.error) return json3({ error: v.error }, 400);
  const { firstName, lastName, email, contact, address, items } = v.clean;
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const totalSgd = totalQty * PRICE_SGD;
  const orderId = newOrderId();
  const itemsSummary = items.map((i) => `${i.colour} x ${i.qty}`).join(", ");
  const origin = new URL(request.url).origin;
  const hitpayBody = {
    amount: totalSgd.toFixed(2),
    currency: "SGD",
    email,
    name: `${firstName} ${lastName}`.trim(),
    phone: contact,
    purpose: `NUSAE Ophelia - ${itemsSummary}`,
    reference_number: orderId,
    payment_methods: ["paynow_online", "card"],
    redirect_url: `${origin}/thank-you?order=${encodeURIComponent(orderId)}`,
    webhook: `${origin}/api/hitpay-webhook`,
    send_email: true
  };
  let hitpayRes, hitpayText;
  try {
    hitpayRes = await fetch(HITPAY_ENDPOINT2, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "X-BUSINESS-API-KEY": env.HITPAY_API_KEY
      },
      body: JSON.stringify(hitpayBody)
    });
    hitpayText = await hitpayRes.text();
  } catch (err) {
    return json3({ error: "Payment provider unreachable", message: String(err && err.message || err) }, 400);
  }
  let hitpay;
  try {
    hitpay = JSON.parse(hitpayText);
  } catch (_) {
    hitpay = {};
  }
  if (!hitpayRes.ok || !hitpay.url) {
    const friendly = hitpay && (hitpay.error_message || hitpay.message) || "Could not start payment \u2014 please try again or contact us.";
    return json3({
      error: friendly,
      hitpay_status: hitpayRes.status,
      detail: hitpay
    }, 400);
  }
  if (env.GAS_WEBHOOK_URL) {
    const orderForSheet = {
      order_id: orderId,
      first_name: firstName,
      last_name: lastName,
      email,
      contact,
      address,
      items,
      total_sgd: totalSgd,
      payment_url: hitpay.url,
      payment_request_id: hitpay.id
    };
    try {
      await fetch(env.GAS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: env.GAS_SHARED_SECRET,
          event: "order_created",
          order: orderForSheet
        })
      });
    } catch (_) {
    }
  }
  return json3({ url: hitpay.url, id: hitpay.id, order_id: orderId });
}
__name(handle, "handle");
function validate(p) {
  if (!p || typeof p !== "object") return { error: "Empty body" };
  const firstName = str(p.firstName, 60);
  const lastName = str(p.lastName, 60);
  const email = str(p.email, 120);
  const contact = str(p.contact, 30);
  const address = str(p.address, 500);
  if (!firstName || !lastName) return { error: "Name required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Valid email required" };
  if (contact.replace(/\D/g, "").length < 6) return { error: "Contact number required" };
  if (address.length < 8) return { error: "Address required" };
  if (!Array.isArray(p.items) || p.items.length === 0) return { error: "At least one colour line required" };
  if (p.items.length > 8) return { error: "Too many colour lines" };
  const items = [];
  for (const raw of p.items) {
    const colour = String(raw.colour || "").toLowerCase().trim();
    const qty = parseInt(raw.qty, 10);
    if (!ALLOWED_COLOURS.has(colour)) return { error: `Invalid colour: ${colour}` };
    if (!(qty >= 1 && qty <= 20)) return { error: "Quantity must be between 1 and 20 per line" };
    items.push({ colour, qty });
  }
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  if (totalQty > 30) return { error: "Order quantity exceeds limit" };
  return { clean: { firstName, lastName, email, contact, address, items } };
}
__name(validate, "validate");
function str(v, max) {
  if (v == null) return "";
  return String(v).trim().slice(0, max);
}
__name(str, "str");
function newOrderId() {
  const d = /* @__PURE__ */ new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `NUS-${ymd}-${rand}`;
}
__name(newOrderId, "newOrderId");
function json3(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(json3, "json");

// api/hitpay-webhook.js
async function onRequestPost4({ request, env }) {
  const rawBody = await request.text();
  let data;
  try {
    data = JSON.parse(rawBody);
  } catch (_) {
    data = Object.fromEntries(new URLSearchParams(rawBody).entries());
  }
  const providedHmac = (data.hmac || "").toString();
  if (!providedHmac) {
    return new Response("Missing hmac field", { status: 400 });
  }
  const fields = { ...data };
  delete fields.hmac;
  const sortedKeys = Object.keys(fields).sort();
  const message = sortedKeys.map((k) => `${k}${fields[k]}`).join("");
  const valid = await verifyHmac(message, providedHmac, env.HITPAY_SALT);
  if (!valid) {
    return new Response("Invalid signature", { status: 401 });
  }
  if (data.status === "completed" && data.reference_number && env.GAS_WEBHOOK_URL) {
    try {
      await fetch(env.GAS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: env.GAS_SHARED_SECRET,
          event: "order_paid",
          order_id: data.reference_number,
          payment: {
            payment_id: data.payment_id || "",
            payment_request_id: data.payment_request_id || "",
            payment_method: data.payment_type || data.payment_method || "PayNow",
            amount: data.amount || "",
            currency: data.currency || "SGD"
          }
        })
      });
    } catch (_) {
    }
  }
  return new Response("OK", { status: 200 });
}
__name(onRequestPost4, "onRequestPost");
async function verifyHmac(message, expectedHex, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const actualHex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(actualHex, expectedHex.toLowerCase());
}
__name(verifyHmac, "verifyHmac");
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
__name(timingSafeEqual, "timingSafeEqual");

// ../.wrangler/tmp/pages-KmfzBd/functionsRoutes-0.13297174411006807.mjs
var routes = [
  {
    routePath: "/api/admin/payment-status",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/admin/recovery-link",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/checkout",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/hitpay-webhook",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  }
];

// ../../../../.npm/_npx/32026684e21afda6/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str2) {
  var tokens = [];
  var i = 0;
  while (i < str2.length) {
    var char = str2[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str2[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str2[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str2[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str2[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str2.length) {
        var code = str2.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str2[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str2[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str2.length) {
        if (str2[j] === "\\") {
          pattern += str2[j++] + str2[j++];
          continue;
        }
        if (str2[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str2[j] === "(") {
          count++;
          if (str2[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str2[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str2[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str2, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str2);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str2, options) {
  var keys = [];
  var re = pathToRegexp(str2, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str2) {
  return str2.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
