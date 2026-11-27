'use strict';

dek450CatalogReady.then(() => {
  const byId = id => document.getElementById(id);
  const productIndex = new Map(products.map(product => [product.id, product]));
  const form = byId("checkoutForm");
  const lines = byId("lines");
  const review = byId("review");
  const fallback = productIndex.get(new URLSearchParams(location.search).get("item"));
  let basket = getBasket();
  let pendingOrder;
  let sending = false;

  if (!basket.length && fallback && fallback.stock !== false) {
    basket = [{id:fallback.id, quantity:1}];
    saveBasket(basket);
    history.replaceState(null, "", location.pathname);
  }

  function progress(current) {
    const steps = ["details", "review", "sent"];
    for (const [index, step] of steps.entries()) {
      const item = byId("step-" + step);
      if (step === current) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
      item.classList.toggle("done", index < steps.indexOf(current));
    }
  }

  function hideReview() {
    if (sending) return;
    pendingOrder = null;
    review.hidden = true;
    form.hidden = false;
    byId("sendStatus").textContent = "";
    progress("details");
  }

  function createIcon(name) {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("class", "icon");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const use = document.createElementNS(namespace, "use");
    use.setAttribute("href", "#co-" + name);
    svg.append(use);
    return svg;
  }

  function renderBasketSummary() {
    const count = basket.reduce((sum, item) => sum + item.quantity, 0);
    byId("basketCount").textContent = count + (count === 1 ? " item" : " items");
    byId("basketCount").hidden = !count;
    byId("emptyBasket").hidden = count > 0;
    byId("basketNote").hidden = !count;
    byId("reviewButton").disabled = !count;
  }

  function renderOrder() {
    lines.replaceChildren();
    for (const item of basket) {
      const product = productIndex.get(item.id);
      const row = document.createElement("div");
      row.className = "line";
      const image = document.createElement("img");
      image.src = productPhotoUrl(product.photos[0].src);
      image.alt = "";
      image.loading = "lazy";
      image.addEventListener("error", () => { image.style.visibility = "hidden"; });
      const info = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = product.name;
      info.append(name);
      if (product.category === "Biomedical equipment") {
        const lead = document.createElement("p");
        lead.className = "line-timing";
        lead.textContent = "Lead time to be confirmed";
        info.append(lead);
      }

      const tools = document.createElement("div");
      tools.className = "line-tools";
      const control = document.createElement("div");
      control.className = "quantity";
      const quantity = document.createElement("input");
      Object.assign(quantity, {type:"number", inputMode:"numeric", min:1, max:999, step:1, value:item.quantity, required:true});
      quantity.setAttribute("aria-label", "Quantity for " + product.name);
      function quantityButton(label, icon, delta) {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-label", label + " for " + product.name);
        button.append(createIcon(icon));
        button.addEventListener("click", () => setQuantity(item.quantity + delta));
        return button;
      }
      const minus = quantityButton("Decrease quantity", "minus", -1);
      const plus = quantityButton("Increase quantity", "plus", 1);
      control.append(minus, quantity, plus);
      quantity.addEventListener("change", () => setQuantity(quantity.valueAsNumber));
      function updateLine() {
        quantity.value = item.quantity;
        minus.disabled = item.quantity <= 1;
        plus.disabled = item.quantity >= 999;
      }
      function setQuantity(value) {
        if (sending) return;
        if (!Number.isInteger(value) || value < 1 || value > 999) {
          updateLine();
          byId("basketStatus").textContent = "Enter a quantity from 1 to 999.";
          return;
        }
        if (value === item.quantity) return;
        item.quantity = value;
        saveBasket(basket);
        hideReview();
        updateLine();
        renderBasketSummary();
        byId("basketStatus").textContent = "Quantity updated.";
      }
      updateLine();
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove";
      remove.append(createIcon("trash"), "Remove");
      remove.setAttribute("aria-label", "Remove " + product.name);
      remove.addEventListener("click", () => {
        if (sending) return;
        basket = basket.filter(line => line.id !== item.id);
        saveBasket(basket);
        hideReview();
        renderOrder();
        byId("basketStatus").textContent = product.name + " removed.";
        const target = lines.querySelector(".remove") || byId("emptyBasket").querySelector("a");
        target.focus();
      });
      tools.append(control, remove);
      row.append(image, info, tools);
      lines.append(row);
    }
    renderBasketSummary();
  }

  function syncDelivery() {
    const method = form.elements.method.value;
    const delivery = byId("deliveryFields");
    delivery.hidden = method !== "delivery";
    delivery.querySelectorAll("input, textarea").forEach(field => { field.disabled = delivery.hidden; });
    byId("pickupNote").hidden = method !== "pickup";
    for (const option of form.querySelectorAll(".method-option")) {
      option.classList.toggle("selected", option.querySelector("input").checked);
    }
  }

  function renderReview(customer) {
    const delivery = customer.method === "delivery";
    const detailList = byId("reviewDetails");
    detailList.replaceChildren();
    const rows = [
      ["Contact", [customer.name, customer.email, customer.company].filter(Boolean).join("\n")],
      ["WhatsApp", customer.phone],
      [delivery ? "Delivery address" : "Pickup location", delivery
        ? [[customer.address, customer.city, customer.region].join(", "), customer.directions].filter(Boolean).join("\n")
        : "PK GREEN SUPPLY VENTURE\nNDC Junction, Cowpea Street, CB69\nKlagon, Lashibi, Tema"],
      ["Order notes", customer.notes],
    ];
    for (const [label, value] of rows) {
      if (!value) continue;
      const group = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      term.textContent = label;
      description.textContent = value;
      group.append(term, description);
      detailList.append(group);
    }
  }

  const phone = form.elements.namedItem("phone");
  function validatePhone() {
    const value = phone.value.trim();
    const digits = value.replace(/\D/g, "");
    const valid = /^\+?[\d ()-]+$/.test(value) && (
      /^0\d{9}$/.test(digits) || /^233\d{9}$/.test(digits) ||
      (value.startsWith("+") && /^[1-9]\d{7,14}$/.test(digits))
    );
    phone.setCustomValidity(!value || valid ? "" : "Enter a Ghana WhatsApp number or include + and the country code.");
  }
  phone.addEventListener("input", validatePhone);
  form.addEventListener("input", hideReview);
  for (const option of form.elements.method) option.addEventListener("change", syncDelivery);
  byId("editOrder").addEventListener("click", () => {
    hideReview();
    byId("detailsHeading").focus();
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    validatePhone();
    if (!basket.length || !form.reportValidity()) return;

    const data = new FormData(form);
    const value = name => (data.get(name) || "").trim();
    const customer = Object.fromEntries(["name", "phone", "email", "company", "method", "region", "city", "address", "directions", "notes"].map(name => [name, value(name)]));
    customer.whatsappOptIn = data.has("whatsappOptIn");
    const packet = { customer, items: basket.map(({id, quantity}) => ({id, quantity})) };
    const fingerprint = JSON.stringify(packet);
    if (!pendingOrder || pendingOrder.fingerprint !== fingerprint) {
      pendingOrder = { payload: {...packet, id: crypto.randomUUID()}, fingerprint };
    }
    renderReview(customer);
    form.hidden = true;
    review.hidden = false;
    progress("review");
    byId("reviewHeading").focus();
  });

  byId("sendOrder").addEventListener("click", async () => {
    if (!pendingOrder || sending) return;
    const send = byId("sendOrder");
    const payload = pendingOrder.payload;
    sending = true;
    send.disabled = true;
    byId("editOrder").disabled = true;
    form.inert = true;
    lines.inert = true;
    byId("sendStatus").textContent = "Sending your request…";
    try {
      const response = await fetch(dek450Service + "/api/order-requests", {
        method: "POST",
        headers: {"Content-Type": "text/plain;charset=UTF-8"},
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25000)
      });
      const result = await response.json();
      if (!response.ok || result.id !== payload.id) throw Error(result.error || "Could not verify receipt.");
      saveBasket([]);
      form.reset();
      basket = [];
      pendingOrder = null;
      byId("reviewDetails").replaceChildren();
      byId("sendStatus").textContent = "";
      review.hidden = true;
      form.hidden = true;
      byId("basketPanel").hidden = true;
      document.querySelector(".layout").classList.add("is-complete");
      progress("sent");
      byId("orderReference").textContent = "Reference: " + result.id;
      byId("confirmedWhatsApp").textContent = payload.customer.phone;
      const invoice = byId("invoiceLink");
      invoice.hidden = !result.invoiceUrl;
      if (result.invoiceUrl) invoice.href = result.invoiceUrl;
      byId("invoiceStatus").textContent = result.invoiceUrl
        ? "Your pro forma invoice is ready to view."
        : "Sales will confirm your invoice when they reach out.";
      byId("orderSent").hidden = false;
      byId("orderSentHeading").focus();
    } catch (issue) {
      byId("sendStatus").textContent = issue.name === "TypeError" || issue.name === "TimeoutError"
        ? "We couldn’t confirm receipt. Tap Send order request again to check, or contact sales."
        : issue.message;
    } finally {
      sending = false;
      send.disabled = false;
      byId("editOrder").disabled = false;
      form.inert = false;
      lines.inert = false;
    }
  });

  syncDelivery();
  byId("basketLoading").hidden = true;
  renderOrder();
});
