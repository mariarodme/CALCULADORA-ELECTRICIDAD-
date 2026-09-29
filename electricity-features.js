"use strict";
(() => {
  const LEGACY_KEY = "mc_electricity_history";
  const $ = (id) => document.getElementById(id);
  const tr = (en, es) => getLanguage() === "es" ? es : en;
  let editingId = null;
  let activeRecord = null;
  let previewRecord = null;
  const originalClearForm = clearForm;

  function storageKey() {
    const uid = window.electricCloud?.uid;
    return uid ? `${LEGACY_KEY}:user:${uid}` : LEGACY_KEY;
  }
  function read(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
    } catch { return []; }
  }
  const isClosure = (item) => item?.kind === "month-close" && /^\d{4}-\d{2}$/.test(item.month || "");
  const rawHistory = () => read(storageKey());
  const closures = () => rawHistory().filter(isClosure);
  const monthOf = (item) => String(item.checkOut || item.checkIn || "").slice(0,7);
  const isClosed = (month) => closures().some((item) => item.month === month);
  function writeAll(records) {
    localStorage.setItem(storageKey(), JSON.stringify(records));
    renderHistory(); renderOverview();
  }
  function write(records) {
    writeAll([...records.filter((item) => !isClosure(item)), ...closures()]);
  }
  getHistory = () => rawHistory().filter((item) => !isClosure(item));
  window.electricityHistory = {
    legacy: () => read(LEGACY_KEY),
    applyRemote(records) {
      if (!window.electricCloud?.uid) return;
      writeAll(records);
    },
    refresh() { renderHistory(); renderOverview(); updateCloudControls(); },
  };

  const mount = document.createElement("div");
  mount.innerHTML = `
    <div class="workflow-note" id="workflowNote" hidden></div>
    <dialog class="invoice-preview" id="invoicePreview" aria-labelledby="previewTitle">
      <div class="preview-head"><div><small id="previewEyebrow"></small><h2 id="previewTitle"></h2></div>
        <button type="button" class="preview-close" id="previewClose" aria-label="Close / Cerrar">×</button></div>
      <div class="preview-grid" id="previewGrid"></div>
      <p class="duplicate-warning" id="duplicateWarning" hidden></p>
      <div class="preview-actions"><button type="button" class="btn-secondary" id="previewBack"></button>
        <button type="button" class="btn-secondary" id="previewDraft"></button>
        <button type="button" class="btn-primary" id="previewSave"></button></div>
    </dialog>`;
  document.querySelector(".actions").before(mount.children[0]);
  document.body.append(mount.children[0]);
  document.querySelector("#page-history .history-count").insertAdjacentHTML("beforebegin", `
    <section class="history-tools" aria-label="History filters / Filtros de historial">
      <label><span id="historySearchLabel"></span><input id="historySearch" type="search" autocomplete="off"></label>
      <label><span id="historyMonthLabel"></span><input id="historyMonth" type="month"></label>
      <label><span id="historyStatusLabel"></span><select id="historyStatus"></select></label>
    </section>
    <div class="report-tools">
      <div><strong id="reportHeading"></strong><p id="reportHint"></p></div>
      <button type="button" class="btn-download" id="downloadMonthly"></button>
    </div>
    <section class="cloud-tools">
      <div><strong id="cloudHeading"></strong><p id="electricCloudStatus" role="status" aria-live="polite"></p></div>
      <div class="cloud-buttons">
        <button type="button" class="btn-primary" id="electricLogin"></button>
        <button type="button" class="btn-secondary" id="electricImport" hidden></button>
        <button type="button" class="btn-secondary" id="electricLogout" hidden></button>
      </div>
    </section>`);

  function localeUI() {
    $("historySearchLabel").textContent = tr("Search client or unit", "Buscar cliente o unidad");
    $("historySearch").placeholder = tr("Name or unit", "Nombre o unidad");
    $("historyMonthLabel").textContent = tr("Month", "Mes");
    $("historyStatusLabel").textContent = tr("Payment status", "Estado del cobro");
    const selected = $("historyStatus").value;
    $("historyStatus").innerHTML = [
      ["", tr("All statuses", "Todos los estados")],
      ["draft", tr("Draft", "Borrador")],
      ["pending", tr("Pending", "Pendiente")],
      ["sent", tr("Sent", "Enviado")],
      ["paid", tr("Paid", "Pagado")],
    ].map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
    $("historyStatus").value = selected;
    $("reportHeading").textContent = tr("Monthly report", "Reporte mensual");
    $("reportHint").textContent = tr("Uses the month selected above. Download an Excel workbook.", "Usa el mes seleccionado arriba. Descargá el archivo de Excel.");
    $("downloadMonthly").textContent = tr("Download Excel", "Descargar Excel");
    $("cloudHeading").textContent = tr("Shared history", "Historial compartido");
    $("electricLogin").textContent = tr("Sign in with Google", "Entrar con Google");
    $("electricImport").textContent = window.electricCloud?.localPending
      ? tr("Sync pending changes", "Sincronizar cambios pendientes")
      : tr("Import this device's invoices", "Subir facturas de este dispositivo");
    $("electricLogout").textContent = tr("Sign out", "Salir");
    $("previewDraft").textContent = tr("Save draft", "Guardar borrador");
    renderOverview();
    updateCloudControls();
  }
  function updateCloudControls() {
    const cloud = window.electricCloud;
    const signed = !!cloud?.uid;
    $("historyStorage").textContent = cloud?.connected
      ? tr("Online history is connected. Invoices saved here are available on your devices.",
          "Historial conectado en línea. Las facturas que guardés aquí estarán disponibles en tus dispositivos.")
      : signed
        ? tr("Check the online connection status in Shared history below.",
            "Revisá el estado de la conexión en Historial compartido, más abajo.")
        : tr("History is saved only in this browser.",
            "El historial se guarda solo en este navegador.");
    $("electricImport").textContent = cloud?.localPending
      ? tr("Sync pending changes", "Sincronizar cambios pendientes")
      : tr("Import this device's invoices", "Subir facturas de este dispositivo");
    $("electricLogin").hidden = signed;
    $("electricLogout").hidden = !signed;
    $("electricImport").hidden = !signed || !cloud?.importable()?.length || !cloud?.connected;
    if (!cloud?.status) $("electricCloudStatus").textContent =
      tr("Sign in to see your invoices on your other devices. Until then, they remain in this browser.",
        "Entrá para ver las facturas en tus otros dispositivos. Hasta entonces, quedan en este navegador.");
    else $("electricCloudStatus").textContent = cloud.status;
  }
  window.electricityRefreshUI = () => { localeUI(); renderHistory(); };
  const originalSetLanguage = setLanguage;
  setLanguage = function (lang) { originalSetLanguage(lang); window.electricityRefreshUI(); };
  const settingsKey = "mc_electricity_invoice_settings";
  function invoiceSettings() {
    try { return JSON.parse(localStorage.getItem(settingsKey) || "{}") || {}; } catch { return {}; }
  }
  function saveInvoiceSettings() {
    localStorage.setItem(settingsKey,JSON.stringify({
      contact:$("billingContact").value.trim(),
      instructions:$("paymentInstructions").value.trim()
    }));
  }
  for (const id of ["billingContact","paymentInstructions"]) $(id).addEventListener("change",saveInvoiceSettings);
  $("billingContact").value = invoiceSettings().contact || "";
  $("paymentInstructions").value = invoiceSettings().instructions || "";
  $("overviewMonth").value = new Date().toISOString().slice(0,7);
  $("overviewMonth").addEventListener("change",renderOverview);
  $("overviewNew").onclick = () => showPage("calculator",document.querySelector('.tab-btn[onclick*="calculator"]'));
  $("overviewHistory").onclick = () => showPage("history",document.querySelector('.tab-btn[onclick*="history"]'));
  localeUI();

  function error(en, es, id) {
    alert(tr(en, es));
    if (id) $(id)?.focus();
  }
  function inputNumber(id) { return Number($(id).value); }
  function makeDraft() {
    const clientName = $("clientName").value.trim(), unitNumber = $("unitNumber").value.trim();
    const checkIn = $("checkIn").value, checkOut = $("checkOut").value;
    const prevReading = inputNumber("prevReading"), currReading = inputNumber("currReading");
    const rateColones = inputNumber("rateColones"), exchangeRate = inputNumber("exchangeRate"), vatRate = inputNumber("vatRate");
    if (!clientName) { error("Enter a client name.", "Ingresá el nombre del cliente.", "clientName"); return null; }
    if (!unitNumber) { error("Enter a unit number.", "Ingresá el número de unidad.", "unitNumber"); return null; }
    if (!checkIn || !checkOut) { error("Enter both stay dates.", "Ingresá las fechas de entrada y salida.", !checkIn ? "checkIn" : "checkOut"); return null; }
    if (checkOut < checkIn) { error("Check-out cannot be before check-in.", "La salida no puede ser anterior a la entrada.", "checkOut"); return null; }
    if ($("prevReading").value === "" || $("currReading").value === "" ||
        !Number.isFinite(prevReading) || !Number.isFinite(currReading) || prevReading < 0 || currReading < prevReading) {
      error("Check the meter readings.", "Revisá las lecturas del medidor.", "prevReading"); return null;
    }
    if ($("rateColones").value === "" || !Number.isFinite(rateColones) || rateColones <= 0) {
      error("Enter a valid rate per kWh.", "Ingresá una tarifa por kWh válida.", "rateColones"); return null;
    }
    if ($("exchangeRate").value === "" || !Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      error("Enter a valid exchange rate.", "Ingresá un tipo de cambio válido.", "exchangeRate"); return null;
    }
    if ($("vatRate").value === "" || !Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
      error("Enter a VAT percentage between 0 and 100.", "Ingresá un IVA entre 0 y 100.", "vatRate"); return null;
    }
    const consumption = currReading - prevReading;
    const subtotalColones = consumption * rateColones;
    const vatAmount = subtotalColones * vatRate / 100;
    const totalColones = subtotalColones + vatAmount;
    const previous = getHistory().find((item) => String(item.id) === String(editingId));
    return {
      id: previous?.id ?? (globalThis.crypto?.randomUUID?.() || String(Date.now())),
      clientName, unitNumber, checkIn, checkOut, prevReading, currReading,
      rateColones, exchangeRate, vatRate, consumption, subtotalColones, vatAmount,
      totalColones, totalUSD: totalColones / exchangeRate,
      preparedName: $("preparedName").value.trim(), preparedTitle: $("preparedTitle").value.trim(),
      status: previous?.status || "pending", paidAt: previous?.paidAt || "",
      workflow: previous?.workflow || "issued",
      paymentInstructions: previous?.paymentInstructions ?? invoiceSettings().instructions ?? "",
      billingContact: previous?.billingContact ?? invoiceSettings().contact ?? "",
      date: previous?.date || new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
  }
  function duplicateOf(record) {
    return getHistory().find((item) => String(item.id) !== String(record.id) &&
      String(item.unitNumber || "").trim().toLowerCase() === record.unitNumber.toLowerCase() &&
      item.checkIn === record.checkIn && item.checkOut === record.checkOut);
  }
  function previewRow(label, value) {
    const row = document.createElement("div");
    const l = document.createElement("span"), v = document.createElement("strong");
    l.textContent = label; v.textContent = value;
    row.append(l, v); return row;
  }
  calculate = function () {
    const record = makeDraft(); if (!record) return;
    previewRecord = record;
    $("previewEyebrow").textContent = tr("REVIEW BEFORE SAVING", "REVISÁ ANTES DE GUARDAR");
    $("previewTitle").textContent = tr("Invoice preview", "Vista previa del cobro");
    $("previewBack").textContent = tr("Back to form", "Volver al formulario");
    $("previewSave").textContent = editingId ? tr("Issue / save changes", "Emitir / guardar cambios") : tr("Issue invoice", "Emitir factura");
    $("previewDraft").textContent = tr("Save draft", "Guardar borrador");
    $("previewGrid").replaceChildren(
      previewRow(tr("Client", "Cliente"), record.clientName),
      previewRow(tr("Unit", "Unidad"), record.unitNumber),
      previewRow(tr("Stay", "Estadía"), formatDate(record.checkIn) + " – " + formatDate(record.checkOut)),
      previewRow(tr("Meter readings", "Lecturas"), record.prevReading.toFixed(2) + " → " + record.currReading.toFixed(2) + " kWh"),
      previewRow(tr("Consumption", "Consumo"), record.consumption.toFixed(2) + " kWh"),
      previewRow(tr("Rate per kWh", "Tarifa por kWh"), "₡" + record.rateColones.toFixed(2)),
      previewRow(tr("VAT", "IVA"), record.vatRate + "%"),
      previewRow(tr("Exchange rate", "Tipo de cambio"), "₡" + record.exchangeRate.toFixed(2)),
      previewRow(tr("Total CRC", "Total en colones"), "₡" + record.totalColones.toFixed(2)),
      previewRow(tr("Total USD", "Total en dólares"), "$" + record.totalUSD.toFixed(2)),
    );
    const duplicate = duplicateOf(record);
    $("duplicateWarning").hidden = !duplicate;
    $("duplicateWarning").textContent = duplicate
      ? tr("There is already an invoice for this unit and stay. Check it before saving another.",
          "Ya existe una factura para esta unidad y estadía. Revisala antes de guardar otra.") : "";
    $("invoicePreview").showModal();
  };
  $("previewClose").onclick = $("previewBack").onclick = () => $("invoicePreview").close();
  $("invoicePreview").addEventListener("click", (event) => {
    if (event.target === $("invoicePreview")) $("invoicePreview").close();
  });
  function savePreview(asDraft) {
    if (!previewRecord) return;
    const item = {...previewRecord, workflow:asDraft ? "draft" : "issued"};
    if (isClosed(monthOf(item))) {
      error("This month is closed. Reopen it before saving.", "Este mes está cerrado. Reabrilo antes de guardar.");
      return;
    }
    const history = getHistory().filter((r) => String(r.id) !== String(item.id));
    history.unshift(item);
    write(history);
    window.electricCloud?.change({kind:"upsert", record:item});
    activeRecord = item; previewRecord = null; editingId = null;
    $("invoicePreview").close();
    $("workflowNote").hidden = true;
    if (asDraft) {
      $("resultPanel").classList.remove("visible");
      $("historyMonth").value=monthOf(item);$("historyStatus").value="draft";
      showPage("history",document.querySelector('.tab-btn[onclick*="history"]'));
      renderHistory();
    } else {
      renderResult(item);
      $("resultPanel").classList.add("visible");
      $("resultPanel").scrollIntoView({behavior:"smooth", block:"start"});
    }
  }
  $("previewSave").onclick = () => savePreview(false);
  $("previewDraft").onclick = () => savePreview(true);
  buildCurrentRecord = () => activeRecord;
  clearForm = function () {
    originalClearForm();
    editingId = null; activeRecord = null; previewRecord = null;
    $("workflowNote").hidden = true;
  };

  function renderResult(r) {
    $("rClientName").textContent = r.clientName;
    $("rUnit").textContent = r.unitNumber;
    $("rPeriod").textContent = formatDate(r.checkIn) + " – " + formatDate(r.checkOut);
    $("rConsumption").textContent = r.consumption.toFixed(2) + " kWh";
    $("rRate").textContent = "₡" + r.rateColones.toLocaleString("en-US",{minimumFractionDigits:2});
    $("rSubtotal").textContent = "₡" + r.subtotalColones.toLocaleString("en-US",{minimumFractionDigits:2});
    $("rVatLabel").textContent = tr("VAT", "IVA") + " (" + r.vatRate + "%)";
    $("rVat").textContent = "₡" + r.vatAmount.toLocaleString("en-US",{minimumFractionDigits:2});
    $("rTotalColones").textContent = "₡" + r.totalColones.toLocaleString("en-US",{minimumFractionDigits:2});
    $("rExchange").textContent = "₡" + r.exchangeRate.toLocaleString("en-US") + " = $1.00";
    $("rTotalUSD").textContent = "$" + r.totalUSD.toFixed(2);
  }

  function editRecord(id) {
    const r = getHistory().find((item) => String(item.id) === String(id));
    if (!r) return;
    if (isClosed(monthOf(r))) { error("This month is closed.", "Este mes está cerrado."); return; }
    editingId = r.id; activeRecord = null;
    for (const key of ["clientName","unitNumber","checkIn","checkOut","prevReading","currReading",
                       "rateColones","exchangeRate","vatRate","preparedName","preparedTitle"]) {
      if ($(key)) $(key).value = r[key] ?? "";
    }
    updateConsumption();
    $("resultPanel").classList.remove("visible");
    $("workflowNote").hidden = false;
    $("workflowNote").textContent = tr("Editing a saved invoice. Calculate to review and save the changes, or Clear to cancel.",
      "Estás editando una factura. Tocá Calcular para revisar y guardar los cambios, o Limpiar para cancelar.");
    showPage("calculator", document.querySelector('.tab-btn[onclick*="calculator"]'));
    $("billing").scrollIntoView({behavior:"smooth", block:"start"});
  }
  function duplicateRecord(id) {
    const r=getHistory().find((item)=>String(item.id)===String(id)); if (!r) return;
    editingId=null;activeRecord=null;previewRecord=null;
    for (const key of ["clientName","unitNumber","rateColones","exchangeRate","vatRate","preparedName","preparedTitle"]) {
      if ($(key)) $(key).value=r[key]??"";
    }
    for (const key of ["checkIn","checkOut","prevReading","currReading","consumption"]) if ($(key)) $(key).value="";
    $("resultPanel").classList.remove("visible");
    $("workflowNote").hidden=false;
    $("workflowNote").textContent=tr("A new invoice was prepared from the previous one. Enter new dates and meter readings.",
      "Se preparó un cobro nuevo con los datos anteriores. Ingresá las fechas y lecturas nuevas.");
    showPage("calculator",document.querySelector('.tab-btn[onclick*="calculator"]'));
    $("checkIn").focus();
  }
  function issueDraft(id) {
    const r=getHistory().find((item)=>String(item.id)===String(id));
    if (!r || r.workflow!=="draft" || isClosed(monthOf(r))) return;
    if (!confirm(tr("Issue this invoice? You can still edit it until the month is closed.",
      "¿Emitir esta factura? Podrás editarla mientras el mes siga abierto."))) return;
    updateRecord(id,{workflow:"issued"});
  }
  function updateRecord(id, patch) {
    const current = getHistory();
    const old = current.find((r) => String(r.id) === String(id)); if (!old) return;
    if (isClosed(monthOf(old))) { error("This month is closed.", "Este mes está cerrado."); return; }
    const record = {...old, ...patch, updatedAt:new Date().toISOString()};
    write(current.map((r) => String(r.id) === String(id) ? record : r));
    window.electricCloud?.change({kind:"upsert", record});
  }
  deleteHistoryItem = function (id) {
    const item=getHistory().find((r)=>String(r.id)===String(id));
    if (item && isClosed(monthOf(item))) { error("This month is closed.", "Este mes está cerrado."); return; }
    if (!confirm(tr("Delete this invoice?","¿Eliminar esta factura?"))) return;
    write(getHistory().filter((r) => String(r.id) !== String(id)));
    window.electricCloud?.change({kind:"delete", id});
  };
  clearHistory = function () {
    if (closures().length) {
      error("Reopen closed months before deleting all invoices.", "Reabrí los meses cerrados antes de eliminar todas las facturas."); return;
    }
    if (!confirm(tr("Delete ALL invoices in this history? This cannot be undone.",
      "¿Eliminar TODAS las facturas de este historial? No se puede deshacer."))) return;
    write([]);
    window.electricCloud?.change({kind:"clear"});
  };

  function renderOverview() {
    const month=$("overviewMonth")?.value || new Date().toLocaleDateString("sv-SE").slice(0,7);
    const rows=getHistory().filter((r)=>monthOf(r)===month);
    const draft=rows.filter((r)=>r.workflow==="draft");
    const pending=rows.filter((r)=>r.workflow!=="draft" && (r.status||"pending")==="pending");
    const sent=rows.filter((r)=>r.workflow!=="draft" && r.status==="sent");
    const paid=rows.filter((r)=>r.workflow!=="draft" && r.status==="paid");
    const cards=$("overviewCards");if(!cards)return;
    $("overviewTitle").textContent=tr("Electricity overview","Resumen de electricidad");
    $("overviewSubtitle").textContent=tr("Invoices and tasks for the selected month.","Facturas y tareas del mes seleccionado.");
    $("overviewMonthLabel").textContent=tr("Month","Mes");
    $("overviewNew").textContent=tr("+ New invoice","+ Nuevo cobro");
    $("overviewTasksTitle").textContent=tr("To review","Por atender");
    $("overviewTasksHint").textContent=tr("Drafts and invoices awaiting payment.","Borradores y facturas pendientes de pago.");
    $("overviewHistory").textContent=tr("View history","Ver historial");
    $("closeTitle").textContent=tr("Monthly close","Cierre mensual");
    $("invoiceSettingsTitle").textContent=tr("PDF design and invoice details","Diseño y datos de la factura PDF");
    $("billingContactLabel").textContent=tr("Billing contact","Contacto de cobros");
    $("paymentInstructionsLabel").textContent=tr("Payment instructions","Instrucciones de pago");
    $("invoiceSettingsHint").textContent=tr("These defaults are saved in this browser and copied into each new invoice.",
      "Estos datos se guardan en este navegador y se copian a cada factura nueva.");
    const items=[
      [tr("Drafts","Borradores"),draft.length,"draft"],
      [tr("Pending","Pendientes"),pending.length,"pending"],
      [tr("Sent","Enviadas"),sent.length,"sent"],
      [tr("Paid","Pagadas"),paid.length,"paid"],
    ];
    cards.replaceChildren();
    for(const [label,count,status] of items){
      const button=document.createElement("button");button.type="button";button.className="electric-overview-card";
      const small=document.createElement("span");small.textContent=label;
      const strong=document.createElement("strong");strong.textContent=String(count);
      const arrow=document.createElement("span");arrow.textContent="Ver facturas →";
      button.append(small,strong,arrow);
      button.onclick=()=>{
        $("historyMonth").value=month;$("historyStatus").value=status;
        showPage("history",document.querySelector('.tab-btn[onclick*="history"]'));
        renderHistory();
      };cards.append(button);
    }
    const tasks=$("overviewTasks");tasks.replaceChildren();
    const open=[...draft,...pending,...sent].sort((a,b)=>String(b.updatedAt||b.date||"").localeCompare(String(a.updatedAt||a.date||""))).slice(0,6);
    if(!open.length){const p=document.createElement("p");p.className="overview-empty";
      p.textContent=tr("Nothing to review this month.","No hay cobros por atender en este mes.");tasks.append(p);}
    for(const item of open){
      const button=document.createElement("button");button.type="button";button.className="overview-task";
      const title=document.createElement("strong");title.textContent=(item.clientName||"—")+" · #"+(item.unitNumber||"—");
      const meta=document.createElement("span");meta.textContent=(item.workflow==="draft"?tr("Draft","Borrador"):item.status==="sent"?tr("Sent","Enviado"):tr("Pending","Pendiente"))+" · $"+Number(item.totalUSD||0).toFixed(2);
      button.append(title,meta);button.onclick=()=>{
        $("historyMonth").value=month;$("historyStatus").value="";
        showPage("history",document.querySelector('.tab-btn[onclick*="history"]'));renderHistory();
        $("historySearch").value=item.unitNumber||item.clientName||"";renderHistory();
      };tasks.append(button);
    }
    const closed=isClosed(month);
    $("closeStatus").textContent=closed
      ? tr("Closed on ","Cerrado el ")+new Date(closures().find((c)=>c.month===month).closedAt).toLocaleString(getLanguage()==="es"?"es-CR":"en-US")
      : tr("Open month · invoices can be edited.","Mes abierto · se pueden editar los cobros.");
    $("closeHint").textContent=closed
      ? tr("Reopen the month to make corrections.","Reabrí el mes si necesitás corregir algo.")
      : tr("Review the report before closing. Editing and deleting invoices will be blocked.","Revisá el reporte antes de cerrar. Se bloqueará la edición y eliminación de facturas.");
    $("closeMonthButton").textContent=closed ? tr("Reopen month","Reabrir mes") : tr("Close month","Cerrar mes");
  }
  $("closeMonthButton").onclick=()=>{
    const month=$("overviewMonth").value;
    if(!/^\d{4}-\d{2}$/.test(month)) { error("Select a month.","Elegí un mes.","overviewMonth");return; }
    const marker=closures().find((item)=>item.month===month);
    if(marker){
      if(!confirm(tr("Reopen this month and allow changes?","¿Reabrir este mes y permitir cambios?")))return;
      writeAll(rawHistory().filter((item)=>String(item.id)!==String(marker.id)));
      window.electricCloud?.change({kind:"delete",id:marker.id});
    } else {
      const open=getHistory().filter((item)=>monthOf(item)===month && item.workflow==="draft").length;
      const prompt=tr("Close this month? "+open+" drafts remain. Editing and deleting invoices for this month will be blocked.",
        "¿Cerrar este mes? Quedan "+open+" borradores. Se bloqueará la edición y eliminación de sus facturas.");
      if(!confirm(prompt))return;
      const record={id:"__electric_close__"+month,kind:"month-close",month,closedAt:new Date().toISOString()};
      writeAll([...rawHistory().filter((item)=>String(item.id)!==record.id),record]);
      window.electricCloud?.change({kind:"upsert",record});
    }
  };
  function publishForUnified() {
    if (window.parent === window || new URLSearchParams(location.search).get("embed") !== "1") return;
    const records = getHistory().map((r) => ({
      id:String(r.id), clientName:String(r.clientName||""), unitNumber:String(r.unitNumber||""),
      checkIn:String(r.checkIn||""), checkOut:String(r.checkOut||""),
      workflow:r.workflow==="draft"?"draft":"issued", status:String(r.status||"pending"),
      totalUSD:Number(r.totalUSD||0)
    }));
    window.parent.postMessage({type:"monte-carlo-electricity-records",records},location.origin);
  }
  renderHistory = function () {
    const all = getHistory();
    publishForUnified();
    const search = $("historySearch").value.trim().toLocaleLowerCase();
    const month = $("historyMonth").value;
    const status = $("historyStatus").value;
    const filtered = all.filter((r) =>
      (!search || [r.clientName,r.unitNumber].some((value) => String(value || "").toLocaleLowerCase().includes(search))) &&
      (!month || (r.checkOut || r.checkIn || "").startsWith(month)) &&
      (!status || (status === "draft" ? r.workflow === "draft" : r.workflow !== "draft" && (r.status || "pending") === status)));
    $("historyCount").textContent = tr(`${filtered.length} of ${all.length} invoices`, `${filtered.length} de ${all.length} facturas`);
    const list = $("historyList");
    list.replaceChildren();
    if (!filtered.length) {
      const p = document.createElement("div"); p.className = "history-empty";
      p.textContent = all.length ? tr("No invoices match these filters.", "No hay facturas con esos filtros.")
        : tr("No invoices saved yet. Calculate a bill to see it here.", "Todavía no hay facturas. Calculá un cobro para verlo aquí.");
      list.append(p); return;
    }
    filtered.forEach((r) => {
      const article = document.createElement("article"); article.className = "history-item";
      article.dataset.invoiceId=String(r.id);
      if (r.workflow === "draft") article.classList.add("is-draft");
      if (isClosed(monthOf(r))) article.classList.add("is-closed");
      const head = document.createElement("div"); head.className = "history-item-header";
      const identity = document.createElement("div");
      const name = document.createElement("div"); name.className = "history-item-name";
      name.textContent = `${r.clientName || "—"} · #${r.unitNumber || "—"}`;
      const date = document.createElement("div"); date.className = "history-item-date";
      date.textContent = tr("Stay", "Estadía") + ": " + formatDate(r.checkIn) + " – " + formatDate(r.checkOut);
      identity.append(name,date);
      const badges=document.createElement("div");badges.className="invoice-badges";
      const stage=document.createElement("span");stage.textContent=r.workflow==="draft" ? tr("DRAFT","BORRADOR") : tr("ISSUED","EMITIDA");
      badges.append(stage);
      if (isClosed(monthOf(r))) { const lock=document.createElement("span");lock.textContent=tr("MONTH CLOSED","MES CERRADO");badges.append(lock); }
      identity.append(badges);
      const amount = document.createElement("strong"); amount.className = "history-total-usd";
      amount.textContent = "$" + Number(r.totalUSD || 0).toFixed(2);
      head.append(identity, amount);
      const details = document.createElement("div"); details.className = "invoice-details";
      details.append(
        previewRow(tr("Consumption", "Consumo"), Number(r.consumption || 0).toFixed(2) + " kWh"),
        previewRow(tr("Total CRC", "Total en colones"), "₡" + Number(r.totalColones || 0).toLocaleString("en-US",{minimumFractionDigits:2})),
        previewRow(tr("Generated", "Generada"), new Date(r.date || Date.now()).toLocaleDateString(getLanguage()==="es"?"es-CR":"en-US"))
      );
      const payment = document.createElement("div"); payment.className = "payment-controls";
      const statusLabel = document.createElement("label"); statusLabel.textContent = tr("Payment status", "Estado del cobro");
      const statusSelect = document.createElement("select");
      [["pending",tr("Pending","Pendiente")],["sent",tr("Sent","Enviado")],["paid",tr("Paid","Pagado")]]
        .forEach(([value,label]) => statusSelect.add(new Option(label,value)));
      statusSelect.value = r.status || "pending";
      statusSelect.disabled = r.workflow === "draft" || isClosed(monthOf(r));
      const dateLabel = document.createElement("label"); dateLabel.textContent = tr("Payment date", "Fecha de pago");
      const paidInput = document.createElement("input"); paidInput.type = "date"; paidInput.value = r.paidAt || "";
      paidInput.setAttribute("aria-label", tr("Payment date", "Fecha de pago"));
      paidInput.disabled = r.workflow === "draft" || isClosed(monthOf(r));
      statusSelect.onchange = () => {
        if (statusSelect.value === "paid" && !paidInput.value) {
          error("Select a payment date before marking this invoice paid.",
            "Elegí la fecha de pago antes de marcar la factura como pagada.");
          statusSelect.value = r.status || "pending"; paidInput.focus(); return;
        }
        updateRecord(r.id, {status:statusSelect.value, paidAt:statusSelect.value==="paid"?paidInput.value:""});
      };
      paidInput.onchange = () => {
        if (statusSelect.value === "paid" && paidInput.value) updateRecord(r.id,{paidAt:paidInput.value});
      };
      statusLabel.append(statusSelect); dateLabel.append(paidInput); payment.append(statusLabel,dateLabel);
      const actions = document.createElement("div"); actions.className = "history-actions";
      const button = (label,cls,fn) => {const b=document.createElement("button");b.type="button";b.className=cls;b.textContent=label;b.onclick=fn;actions.append(b)};
      if (!isClosed(monthOf(r))) {
        button(tr("Edit","Editar"),"btn-secondary",()=>editRecord(r.id));
        if (r.workflow === "draft") button(tr("Issue invoice","Emitir factura"),"btn-primary",()=>issueDraft(r.id));
      }
      button(tr("Duplicate","Duplicar"),"btn-secondary",()=>duplicateRecord(r.id));
      if (r.workflow !== "draft") button(tr("Print","Imprimir"),"btn-secondary",()=>generatePrint(r,r.preparedName||"",r.preparedTitle||""));
      if (r.workflow !== "draft") button(tr("Download PDF","Descargar PDF"),"btn-download",()=>downloadPDFRecord(r,r.preparedName||"",r.preparedTitle||""));
      if (r.workflow !== "draft") button("WhatsApp","btn-whatsapp",()=>window.open("https://wa.me/?text="+encodeURIComponent(buildMessage(r)),"_blank"));
      if (r.workflow !== "draft") button(tr("Email","Correo"),"btn-email",()=>{location.href="mailto:?subject="+encodeURIComponent(tr("Electricity Invoice","Cobro de electricidad")+" – "+r.clientName)+"&body="+encodeURIComponent(buildMessage(r))});
      if (!isClosed(monthOf(r))) button(tr("Delete","Eliminar"),"btn-danger",()=>deleteHistoryItem(r.id));
      article.append(head,details,payment,actions); list.append(article);
    });
  };
  ["historySearch","historyMonth","historyStatus"].forEach((id) => $(id).addEventListener("input",renderHistory));
  $("downloadMonthly").onclick = () => {
    const month = $("historyMonth").value;
    if (!month) { error("Select a month first.", "Primero escogé un mes.", "historyMonth"); return; }
    const rows = getHistory().filter((r) => (r.checkOut || r.checkIn || "").startsWith(month))
      .map((r) => [r.checkIn+" – "+r.checkOut,r.clientName,r.unitNumber,
        Number(r.consumption||0).toFixed(2),Number(r.rateColones||0).toFixed(2),
        Number(r.totalColones||0).toFixed(2),Number(r.totalUSD||0).toFixed(2),
        r.workflow==="draft" ? tr("Draft","Borrador") : ({pending:tr("Pending","Pendiente"),sent:tr("Sent","Enviado"),paid:tr("Paid","Pagado")})[r.status||"pending"],r.paidAt||""]);
    if (!rows.length) { error("No invoices for this month.", "No hay facturas en ese mes."); return; }
    const blob = makeReportWorkbook({
      title:tr("Monthly electricity report","Reporte mensual de electricidad"), period:month,
      company:"Monte Carlo",headings:tr(
        ["Stay","Client","Unit","kWh","Rate CRC","Total CRC","Total USD","Status","Paid on"],
        ["Estadía","Cliente","Unidad","kWh","Tarifa CRC","Total CRC","Total USD","Estado","Fecha de pago"]),
      rows,
    });
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="Electricidad_Monte_Carlo_"+month+".xlsx";document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  };
  $("electricLogin").onclick = () => window.electricCloud?.signIn();
  $("electricLogout").onclick = () => window.electricCloud?.signOut();
  $("electricImport").onclick = () => {
    const cloud=window.electricCloud;
    if (!cloud) return;
    if (confirm(cloud.localPending
      ? tr("Sync the changes made on this device with the online history?",
          "¿Sincronizar los cambios realizados en este dispositivo con el historial en línea?")
      : tr("Add invoices from this device to your online history? Existing online invoices will remain.",
          "¿Agregar las facturas de este dispositivo al historial en línea? Las facturas existentes permanecerán.")))
      cloud.importLocal(cloud.importable());
  };
  window.addEventListener("message",(event)=>{
    if(event.origin!==location.origin || event.source!==window.parent || !event.data)return;
    if(event.data.type==="monte-carlo-electricity-request"){publishForUnified();return;}
    if(event.data.type!=="monte-carlo-electricity-open")return;
    const target=getHistory().find((r)=>String(r.id)===String(event.data.id));
    $("historyMonth").value=target ? String(target.checkOut||target.checkIn||"").slice(0,7) : (event.data.month||"");
    $("historySearch").value=target ? (target.clientName||target.unitNumber||"") : (event.data.search||"");
    $("historyStatus").value="";
    showPage("history",document.querySelector('.tab-btn[onclick*="history"]'));
    renderHistory();
    if(target) requestAnimationFrame(()=>document.querySelectorAll(".history-item").forEach((item)=>{
      if(item.dataset.invoiceId===String(target.id))item.scrollIntoView({block:"center",behavior:"smooth"});
    }));
  });
  renderHistory();
})();
