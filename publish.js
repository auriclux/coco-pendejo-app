"use strict";
/*
 * Coco Pendejo — publish bridge (alpha, Baby Step 12B)
 *
 * A bolt-on module for the shop board (index.html). It does
 * not modify board state. It adds, under each car card, a
 * "customer page" control strip:
 *
 *   - Link a board car to a substrate episode (one time).
 *   - "Sign Off & Publish": compose the customer snapshot
 *     from the board's tasks and call shop_publish_snapshot
 *     with the actor id from the shop link (?a=...), which
 *     is remembered on the device.
 *
 * Mapping from the board to Current Status:
 *   - done tasks                       -> signedOff
 *   - open tasks on a Waiting Parts car -> waitingOn
 *     (with part detail when the task carries partInfo)
 *   - other open tasks                 -> inProgress
 * The Story gains one entry per publish naming the tasks
 * signed off since the previous publish (diffed against
 * the last document this device sent, kept in localStorage
 * under oo_links). blessedDoneDate and episode state carry
 * over from that last document; the board does not own them.
 *
 * The headline is prefilled and editable in this test
 * harness. Omar's voice-first headline flow is a later
 * design step; this module proves the pipe, not the UX.
 */

var COCO_SUPABASE_URL = "https://lnyfpelahepvwlfwppgj.supabase.co";
var COCO_PUBLISHABLE_KEY = "sb_publishable_yEcdzGdtwcZr4XJm5qSdrw_XDgtezjP";

function cocoToday() {
  var d = new Date();
  function p(n) { return String(n).padStart(2, "0"); }
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

function cocoActorId() {
  var fromUrl = new URLSearchParams(window.location.search).get("a");
  if (fromUrl) {
    localStorage.setItem("oo_actor", fromUrl);
    return fromUrl;
  }
  return localStorage.getItem("oo_actor") || "";
}

function cocoLinks() {
  try { return JSON.parse(localStorage.getItem("oo_links")) || {}; }
  catch (e) { return {}; }
}

function cocoSaveLinks(links) {
  localStorage.setItem("oo_links", JSON.stringify(links));
}

function cocoBoardProjects() {
  try { return JSON.parse(localStorage.getItem("oo_projects")) || []; }
  catch (e) { return []; }
}

function cocoEl(tag, text, cls) {
  var n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}

function cocoGeneratedHeadline(project, newDone) {
  var doneCount = project.tasks.filter(function (t) { return t.done; }).length;
  var openCount = project.tasks.length - doneCount;
  if (newDone.length > 0) {
    return "Signed off: " + newDone.join(", ") + ".";
  }
  if (doneCount > 0) {
    return doneCount + " tasks signed off. " + openCount + " to go.";
  }
  return "Work is under way.";
}

function cocoCompose(project, link, headline) {
  var signedOff = [];
  var inProgress = [];
  var waitingOn = [];
  project.tasks.forEach(function (t) {
    if (t.done) { signedOff.push(t.text); return; }
    if (project.status === "Waiting Parts") {
      if (t.partInfo && (t.partInfo.desc || t.partInfo.vendor)) {
        var w = t.partInfo.desc || t.text;
        if (t.partInfo.eta) w += ", due " + t.partInfo.eta;
        waitingOn.push(w);
      } else {
        waitingOn.push(t.text);
      }
    } else {
      inProgress.push(t.text);
    }
  });

  var last = link.lastDoc || null;
  var lastSigned = last && last.currentStatus ? (last.currentStatus.signedOff || []) : [];
  var newDone = signedOff.filter(function (x) { return lastSigned.indexOf(x) === -1; });

  var story = last && last.story ? last.story.slice() : [];
  if (newDone.length > 0) {
    story.push({ date: cocoToday(), text: "Omar signed off: " + newDone.join(", ") + "." });
  }

  return {
    doc: {
      v: 1,
      asOf: cocoToday(),
      state: last ? last.state : "active",
      carName: link.carName,
      episodeTitle: link.episodeTitle,
      currentStatus: {
        headline: headline,
        signedOff: signedOff,
        inProgress: inProgress,
        waitingOn: waitingOn
      },
      story: story,
      blessedDoneDate: last ? last.blessedDoneDate : null
    },
    newDone: newDone
  };
}

function cocoLinkFlow(project) {
  var actor = cocoActorId();
  if (!actor) {
    actor = window.prompt("Actor key for this device (from the shop link):", "") || "";
    if (!actor) return;
    localStorage.setItem("oo_actor", actor);
  }
  var episodeId = window.prompt(
    "Episode ID for \"" + project.title + "\" (from the substrate):", "");
  if (!episodeId) return;
  var carName = window.prompt("Customer-facing car name:", project.title);
  if (!carName) return;
  var episodeTitle = window.prompt("Job title (episode):", "") || "";
  var links = cocoLinks();
  links[project.title] = {
    episodeId: episodeId.trim(),
    carName: carName,
    episodeTitle: episodeTitle,
    lastDoc: null
  };
  cocoSaveLinks(links);
  cocoDecorate();
}

function cocoPublish(project, link, headlineInput, statusEl) {
  var actor = cocoActorId();
  if (!actor) {
    statusEl.textContent = "No actor key on this device yet. Link the car first.";
    return;
  }
  var composed = cocoCompose(project, link, headlineInput.value.trim() || cocoGeneratedHeadline(project, []));
  statusEl.textContent = "Publishing...";
  fetch(COCO_SUPABASE_URL + "/rest/v1/rpc/shop_publish_snapshot", {
    method: "POST",
    headers: {
      "apikey": COCO_PUBLISHABLE_KEY,
      "Authorization": "Bearer " + COCO_PUBLISHABLE_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      p_actor_id: actor,
      p_episode_id: link.episodeId,
      p_snapshot: composed.doc
    })
  }).then(function (resp) {
    if (!resp.ok) {
      statusEl.textContent = "Publish failed (HTTP " + resp.status + "). Nothing was sent.";
      return null;
    }
    return resp.json();
  }).then(function (version) {
    if (version == null) {
      if (statusEl.textContent === "Publishing...") {
        statusEl.textContent = "Publish refused. The actor key cannot sign off.";
      }
      return;
    }
    link.lastDoc = composed.doc;
    var links = cocoLinks();
    links[project.title] = link;
    cocoSaveLinks(links);
    statusEl.textContent = "Published v" + version + " — the customer's page now shows this.";
    headlineInput.value = cocoGeneratedHeadline(project, []);
  }).catch(function () {
    statusEl.textContent = "Publish failed (network). Nothing was sent.";
  });
}

function cocoDecorate() {
  var projects = cocoBoardProjects();
  var links = cocoLinks();
  document.querySelectorAll(".car-card").forEach(function (card) {
    if (card.querySelector(".coco-pub")) return;
    var titleEl = card.querySelector(".car-title");
    if (!titleEl) return;
    var project = null;
    projects.forEach(function (p) { if (p.title === titleEl.textContent) project = p; });
    if (!project) return;

    var bar = cocoEl("div", null, "coco-pub");
    var link = links[project.title];

    if (!link) {
      var linkBtn = cocoEl("button", "🔗 Link customer page", "coco-pub-btn");
      linkBtn.addEventListener("click", function () { cocoLinkFlow(project); });
      bar.appendChild(linkBtn);
    } else {
      var fresh = cocoCompose(project, link, "");
      var input = document.createElement("input");
      input.type = "text";
      input.className = "coco-pub-headline";
      input.value = cocoGeneratedHeadline(project, fresh.newDone);
      input.setAttribute("aria-label", "Headline for the customer page");
      var status = cocoEl("span", "", "coco-pub-status");
      var pubBtn = cocoEl("button", "✅ Sign Off & Publish", "coco-pub-btn");
      pubBtn.addEventListener("click", function () { cocoPublish(project, link, input, status); });
      var unBtn = cocoEl("button", "Unlink", "coco-pub-unlink");
      unBtn.addEventListener("click", function () {
        var all = cocoLinks();
        delete all[project.title];
        cocoSaveLinks(all);
        bar.remove();
        cocoDecorate();
      });
      bar.appendChild(input);
      var row = cocoEl("div", null, "coco-pub-row");
      row.appendChild(pubBtn);
      row.appendChild(status);
      row.appendChild(unBtn);
      bar.appendChild(row);
    }
    card.appendChild(bar);
  });
}

/* Styles, injected so index.html needs no CSS changes. */
var cocoStyle = document.createElement("style");
cocoStyle.textContent =
  ".coco-pub{margin-top:10px;padding-top:10px;border-top:1px dashed #4a5568;}" +
  ".coco-pub-btn{background:#2f855a;color:#fff;border:none;border-radius:6px;" +
  "padding:8px 12px;font-size:14px;cursor:pointer;}" +
  ".coco-pub-headline{width:100%;box-sizing:border-box;margin-bottom:8px;" +
  "padding:8px;border-radius:6px;border:1px solid #4a5568;" +
  "background:#1a202c;color:#e2e8f0;font-size:14px;}" +
  ".coco-pub-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}" +
  ".coco-pub-status{color:#a0aec0;font-size:13px;}" +
  ".coco-pub-unlink{background:none;border:none;color:#718096;" +
  "font-size:12px;cursor:pointer;text-decoration:underline;}";
document.head.appendChild(cocoStyle);

/* Decorate now, and after every board re-render. */
if (typeof window.renderBoard === "function") {
  var cocoOrigRenderBoard = window.renderBoard;
  window.renderBoard = function () {
    cocoOrigRenderBoard();
    cocoDecorate();
  };
}
cocoDecorate();
