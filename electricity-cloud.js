"use strict";
(() => {
  const config = window.ELECTRICITY_FIREBASE;
  const legacy = "mc_electricity_history";
  let authModule, dbModule, auth, database, recordRef, unsubscribe, currentUid = null;
  let connected = false, localPending = false, pending = 0, queue = Promise.resolve();
  let status = "";
  const language = () => document.getElementById("languageSelect")?.value === "es";
  const tr = (en, es) => language() ? es : en;
  const refresh = () => window.electricityHistory?.refresh();
  function tell(en, es) { status = tr(en, es); refresh(); }
  const scopedKey = () => legacy + ":user:" + currentUid;
  const pendingKey = () => legacy + ":pending:" + currentUid;
  const importedKey = () => legacy + ":imported:" + currentUid;
  function pendingActions() {
    try { const value=JSON.parse(localStorage.getItem(pendingKey())||"[]"); return Array.isArray(value)?value:[]; }
    catch { return []; }
  }
  function addPending(action) {
    localStorage.setItem(pendingKey(),JSON.stringify([...pendingActions(),action]));
    localPending=true;
  }
  function applyAction(rows,action) {
    if (action.kind==="clear") return [];
    if (action.kind==="delete") return rows.filter((r)=>String(r.id)!==String(action.id));
    if (action.kind==="upsert") return [action.record,...rows.filter((r)=>String(r.id)!==String(action.record.id))];
    return rows;
  }
  function localRecords(key) {
    try { const data=JSON.parse(localStorage.getItem(key)||"[]"); return Array.isArray(data)?data:[]; }
    catch { return []; }
  }
  function setPending(value) {
    localPending = value;
    if (!value && currentUid) localStorage.removeItem(pendingKey());
  }
  const cloud = window.electricCloud = {
    get uid() { return currentUid; },
    get connected() { return connected; },
    get localPending() { return localPending; },
    get status() { return status; },
    async signIn() {
      if (!authModule || !auth) {
        tell("Online sign-in is unavailable. Check your connection.",
          "No se puede abrir el acceso en línea. Revisá la conexión.");
        return;
      }
      try {
        await authModule.signInWithPopup(auth,new authModule.GoogleAuthProvider());
      } catch (e) {
        tell("Sign-in was not completed: "+e.message,"No se completó el ingreso: "+e.message);
      }
    },
    async signOut() {
      if (auth && authModule) await authModule.signOut(auth);
    },
    change(action) {
      if (!currentUid) return;
      if (!connected || localPending) {
        addPending(action);
        tell("Changes were saved on this device, but are not online yet. Reconnect and import them.",
          "Los cambios quedaron en este dispositivo, pero aún no están en línea. Reconectá y subilos.");
        return;
      }
      pending++;
      queue = queue.catch(() => {}).then(async () => {
        if (!recordRef || !currentUid) return;
        try {
          const result = await dbModule.runTransaction(recordRef,(current) => {
            const rows=Array.isArray(current?.records) ? current.records.slice() : [];
            const next=applyAction(rows,action);
            return {revision:(Number(current?.revision)||0)+1,records:next,updatedAt:Date.now()};
          },{applyLocally:false});
          if (!result.committed) throw new Error("Transaction was not completed");
          if (pending===1 && !localPending) localStorage.setItem(scopedKey(),JSON.stringify(result.snapshot.val()?.records||[]));
          if (!localPending) tell("Saved online · available on your devices","Guardado en línea · disponible en tus dispositivos");
        } catch (e) {
          addPending(action);
          tell("Online save failed: "+e.message+". Your changes remain on this device.",
            "No se guardó en línea: "+e.message+". Los cambios siguen en este dispositivo.");
        } finally { pending--; refresh(); }
      });
    },
    async importLocal(records) {
      if (!connected || !recordRef || !currentUid) return;
      await queue.catch(()=>{});
      const actions=pendingActions();
      if (!actions.length && !records.length) return;
      const legacyFingerprint=JSON.stringify(localRecords(legacy));
      const isLegacyImport=JSON.stringify(records)===legacyFingerprint;
      pending++;
      try {
        const result=await dbModule.runTransaction(recordRef,(current) => {
          const online=Array.isArray(current?.records)?current.records:[];
          const seen=new Set(online.map((r)=>String(r.id)));
          const merged=actions.length ? actions.reduce(applyAction,online) :
            [...online,...records.filter((r)=>!seen.has(String(r.id)))];
          return {revision:(Number(current?.revision)||0)+1,
            records:merged,updatedAt:Date.now()};
        },{applyLocally:false});
        if (!result.committed) throw new Error("Import did not finish");
        localStorage.setItem(scopedKey(),JSON.stringify(result.snapshot.val()?.records||[]));
        if (isLegacyImport) localStorage.setItem(importedKey(),legacyFingerprint);
        setPending(false);
        tell("Invoices imported and saved online","Facturas importadas y guardadas en línea");
      } catch(e) {
        tell("Import failed: "+e.message,"No se pudieron subir los datos: "+e.message);
      } finally {pending--;refresh()}
    },
    importable() {
      if (!currentUid || !connected) return [];
      if (localPending) return pendingActions().length ? pendingActions() : localRecords(scopedKey());
      const rows=localRecords(legacy);
      return localStorage.getItem(importedKey())===JSON.stringify(rows) ? [] : rows;
    },
  };
  if (!config?.apiKey || !config?.databaseURL) {
    tell("Online storage is not configured.","El guardado en línea no está configurado.");
    return;
  }
  (async () => {
    try {
      const version="12.19.0";
      const [app,authSDK,dbSDK]=await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${version}/firebase-database.js`),
      ]);
      authModule=authSDK;dbModule=dbSDK;
      const client=app.initializeApp(config);
      auth=authSDK.getAuth(client);
      database=dbSDK.getDatabase(client);
      authSDK.onAuthStateChanged(auth,(account) => {
        if (unsubscribe) unsubscribe();
        unsubscribe=null;connected=false;recordRef=null;
        currentUid=account?.uid||null;
        if (!currentUid) {
          setPending(false);
          tell("Local history · sign in to sync devices",
            "Historial local · ingresá para compartirlo entre dispositivos");
          return;
        }
        localPending=pendingActions().length>0;
        if (!localRecords(scopedKey()).length && localRecords(legacy).length &&
            localStorage.getItem(importedKey())!==JSON.stringify(localRecords(legacy))) {
          localStorage.setItem(scopedKey(),JSON.stringify(localRecords(legacy)));
          localPending=true;
        }
        tell("Connecting to online history…","Conectando el historial en línea…");
        recordRef=dbSDK.ref(database,`electricity/${currentUid}`);
        unsubscribe=dbSDK.onValue(recordRef,(snapshot) => {
          const remote=snapshot.val();
          connected=true;
          const online=Array.isArray(remote?.records)?remote.records:[];
          if (pending || localPending) {
            tell("This device has changes to upload. Use the import button after reviewing.",
              "Este dispositivo tiene cambios por subir. Revisalos y usá el botón para importarlos.");
            return;
          }
          const scoped=localRecords(scopedKey());
          if (!remote && scoped.length) {
            localPending=true;
            tell("Local invoices are ready to upload. Use the import button.",
              "Hay facturas locales listas para subir. Usá el botón de importación.");
            return;
          }
          localStorage.setItem(scopedKey(),JSON.stringify(online));
          tell("Saved online · available on your devices",
            "Guardado en línea · disponible en tus dispositivos");
        },(error) => {
          connected=false;
          const denied=String(error.code||error.message).toLowerCase().includes("permission");
          tell(denied ? "Firebase rules must allow your private electricity history."
            : "Online history could not be opened: "+error.message,
            denied ? "Falta habilitar el historial privado de electricidad en las reglas de Firebase."
            : "No se pudo abrir el historial en línea: "+error.message);
        });
      },(error)=>tell("Sign-in error: "+error.message,"Error al ingresar: "+error.message));
    } catch(e) {
      tell("Online storage could not load. Local history still works.",
        "No se pudo cargar el guardado en línea. El historial local sigue funcionando.");
    }
  })();
})();
