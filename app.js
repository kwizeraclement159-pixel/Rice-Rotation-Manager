/* ==========================================
   RICEROTATIONMANAGER
   JavaScript + Supabase
========================================== */

// 1. SUPABASE CONNECTION

const SUPABASE_URL = "https://hgvapidbospojhnnctoa.supabase.co";

const SUPABASE_KEY = "sb_publishable_l3hhPQqcRBmEz177JjerxQ_dFam2U2C";

const RICE_TABLE = "rice_takes";
const CHAT_TABLE = "chat_messages";

const PEOPLE = ["Firomeni", "Odeta", "Zula"];

// Gahunda itangirira ku wa Mbere, 19 Ukwakira 2026.
// Firomeni ni we utangira.
const ROTATION_START_DATE = "2026-10-19";

const headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json"
};


// 2. HELPER FUNCTIONS

function getElement(id) {
    return document.getElementById(id);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[char];
    });
}

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
    if (!dateString) return "";

    const date = new Date(dateString + "T12:00:00");

    return date.toLocaleDateString("rw-RW", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

function showStatus(elementId, message, isError = false) {
    const element = getElement(elementId);

    if (!element) return;

    element.textContent = message;
    element.style.color = isError ? "#c62828" : "#087443";
}


// 3. SUPABASE REQUEST FUNCTION

async function supabaseRequest(table, options = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${table}`;

    const response = await fetch(url, {
        method: options.method || "GET",

        headers: {
            ...headers,
            ...(options.headers || {})
        },

        body: options.body
            ? JSON.stringify(options.body)
            : undefined
    });

    const responseText = await response.text();

    let result = null;

    if (responseText) {
        try {
            result = JSON.parse(responseText);
        } catch {
            result = responseText;
        }
    }

    if (!response.ok) {
        console.error("Supabase error:", result);

        throw new Error(
            result?.message ||
            result?.hint ||
            `Supabase error: ${response.status}`
        );
    }

    return result;
}


// 4. NAVIGATION

function setupNavigation() {
    const buttons = document.querySelectorAll(".nav-btn");
    const pages = document.querySelectorAll(".page");

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            const pageId = button.dataset.page;

            buttons.forEach(item => {
                item.classList.remove("active");
            });

            pages.forEach(page => {
                page.classList.remove("active");
            });

            button.classList.add("active");

            const selectedPage = getElement(pageId);

            if (selectedPage) {
                selectedPage.classList.add("active");
            }

            if (pageId === "history") {
                loadRiceHistory();
            }

            if (pageId === "messages") {
                loadMessages();
            }
        });
    });
}


// 5. ROTATION SCHEDULE

function getRotationPerson(dateString) {
    const date = new Date(dateString + "T12:00:00");

    // Ku wa Gatandatu no ku Cyumweru nta muntu uhabwa umuceri.
    const weekday = date.getDay();

    if (weekday === 0 || weekday === 6) {
        return null;
    }

    const startDate = new Date(
        ROTATION_START_DATE + "T12:00:00"
    );

    if (date < startDate) {
        return null;
    }

    let workdayCount = 0;

    const current = new Date(startDate);

    while (current < date) {
        current.setDate(current.getDate() + 1);

        const day = current.getDay();

        if (day !== 0 && day !== 6 && current <= date) {
            workdayCount++;
        }
    }

    return PEOPLE[workdayCount % PEOPLE.length];
}


function getNextWorkday(dateString) {
    const date = new Date(dateString + "T12:00:00");

    date.setDate(date.getDate() + 1);

    while (
        date.getDay() === 0 ||
        date.getDay() === 6
    ) {
        date.setDate(date.getDate() + 1);
    }

    return getLocalDateString(date);
}


function updateRotation() {
    const today = getLocalDateString();
    const todayPerson = getRotationPerson(today);

    if (getElement("todayDate")) {
        getElement("todayDate").textContent = formatDate(today);
    }

    if (getElement("todayPerson")) {
        getElement("todayPerson").textContent =
            todayPerson || "Nta muntu ufata umuceri uyu munsi";
    }

    const nextDate = getNextWorkday(today);
    const nextPerson = getRotationPerson(nextDate);

    if (getElement("nextPerson")) {
        getElement("nextPerson").textContent =
            nextPerson || "Reba itariki y'itangiriro rya gahunda";
    }

    // Iyo umuntu ahinduye itariki yo gufata umuceri,
    // turamwereka umuntu uteganyijwe kuri iyo tariki.
    const dateInput = getElement("riceDate");
    const personInput = getElement("ricePerson");

    if (dateInput && !dateInput.value) {
        dateInput.value = today;
    }

    if (dateInput && personInput) {
        const expectedPerson = getRotationPerson(dateInput.value);

        if (expectedPerson) {
            personInput.value = expectedPerson;
        }
    }
}


// 6. RICE RECORDS: SAVE TO SUPABASE

async function saveRiceRecord(event) {
    event.preventDefault();

    const date = getElement("riceDate").value;
    const person = getElement("ricePerson").value;
    const quantity = Number(getElement("riceQuantity").value);
    const notes = getElement("riceNotes").value.trim();

    if (!date || !person || !Number.isFinite(quantity) || quantity <= 0) {
        showStatus(
            "riceStatus",
            "Reba neza itariki, izina n'ingano y'umuceri.",
            true
        );

        return;
    }

    const expectedPerson = getRotationPerson(date);

    if (!expectedPerson) {
        showStatus(
            "riceStatus",
            "Iyo tariki ntiri muri gahunda y'iminsi y'akazi cyangwa iri mbere y'itangiriro rya gahunda.",
            true
        );

        return;
    }

    if (person !== expectedPerson) {
        const confirmChange = window.confirm(
            `Gahunda igaragaza ko ${expectedPerson} ari we wari ufite umuceri kuri iyo tariki. ` +
            `Wahisemo ${person}. Urashaka kubika aya makuru uko wayahisemo?`
        );

        if (!confirmChange) return;
    }

    const submitButton = document.querySelector(
        "#riceForm button[type='submit']"
    );

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Birimo kubikwa...";
    }

    showStatus("riceStatus", "");

    try {
        await supabaseRequest(RICE_TABLE, {
            method: "POST",

            headers: {
                "Prefer": "return=representation"
            },

            body: {
                rice_date: date,
                person_name: person,
                quantity_kg: quantity,
                notes: notes
            }
        });

        showStatus(
            "riceStatus",
            "Amakuru yabitswe neza muri Supabase! ✅"
        );

        getElement("riceForm").reset();

        getElement("riceDate").value = getLocalDateString();

        updateRotation();

        await loadRiceHistory();

    } catch (error) {
        showStatus(
            "riceStatus",
            "Ntibyashobotse kubika amakuru. Reba internet, imbonerahamwe rice_takes na RLS muri Supabase. " +
            error.message,
            true
        );

    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Bika amakuru";
        }
    }
}


// 7. RICE HISTORY: LOAD FROM SUPABASE

async function loadRiceHistory() {
    const container = getElement("historyList");

    if (!container) return;

    container.innerHTML =
        '<p class="empty-message">Birimo kuzana amateka...</p>';

    try {
        const records = await supabaseRequest(
            `${RICE_TABLE}?select=*&order=rice_date.desc,created_at.desc&limit=100`
        );

        if (!records || records.length === 0) {
            container.innerHTML =
                '<p class="empty-message">Nta makuru araboneka.</p>';

            return;
        }

        container.innerHTML = records.map(record => `
            <article class="history-item">
                <h3>${escapeHTML(record.person_name)}</h3>

                <p>
                    Itariki:
                    ${escapeHTML(formatDate(record.rice_date))}
                </p>

                <p class="quantity">
                    Umuceri: ${escapeHTML(record.quantity_kg)} kg
                </p>

                ${
                    record.notes
                        ? `<p>Ibindi: ${escapeHTML(record.notes)}</p>`
                        : ""
                }
            </article>
        `).join("");

    } catch (error) {
        console.error("Rice history error:", error);

        container.innerHTML = `
            <p class="empty-message">
                Ntibyashobotse kuzana amateka.
                Reba ko imbonerahamwe rice_takes iri muri Supabase
                kandi ko ifite uburenganzira bwo gusoma.
            </p>
        `;
    }
}


// 8. CHAT: SEND MESSAGE TO SUPABASE

async function sendMessage(event) {
    event.preventDefault();

    const sender = getElement("personName").value;
    const message = getElement("messageText").value.trim();

    if (!sender) {
        showStatus(
            "messageStatus",
            "Banza uhitemo izina ryawe.",
            true
        );

        return;
    }

    if (!message) {
        showStatus(
            "messageStatus",
            "Banza wandike ubutumwa.",
            true
        );

        return;
    }

    const sendButton = getElement("sendMessage");

    if (sendButton) {
        sendButton.disabled = true;
        sendButton.textContent = "Birimo koherezwa...";
    }

    showStatus("messageStatus", "");

    try {
        await supabaseRequest(CHAT_TABLE, {
            method: "POST",

            headers: {
                "Prefer": "return=minimal"
            },

            body: {
                sender: sender,
                message: message
            }
        });

        getElement("messageText").value = "";

        showStatus("messageStatus", "Ubutumwa bwoherejwe! ✅");

        await loadMessages();

    } catch (error) {
        showStatus(
            "messageStatus",
            "Ubutumwa ntibwoherejwe. Reba internet, chat_messages na RLS muri Supabase. " +
            error.message,
            true
        );

    } finally {
        if (sendButton) {
            sendButton.disabled = false;
            sendButton.textContent = "Ohereza ➤";
        }
    }
}


// 9. CHAT: LOAD MESSAGES FROM SUPABASE

async function loadMessages() {
    const container = getElement("messagesList");

    if (!container) return;

    try {
        const messages = await supabaseRequest(
            `${CHAT_TABLE}?select=id,sender,message,created_at&order=created_at.asc&limit=100`
        );

        if (!messages || messages.length === 0) {
            container.innerHTML =
                '<p class="empty-message">Nta butumwa buraboneka. Tangira ikiganiro!</p>';

            return;
        }

        const currentSender = getElement("personName")?.value || "";

        container.innerHTML = messages.map(item => {
            const mine = item.sender === currentSender;

            const time = item.created_at
                ? new Date(item.created_at).toLocaleString("rw-RW", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "short"
                })
                : "";

            return `
                <article class="message-bubble ${mine ? "mine" : ""}">
                    <div class="message-sender">
                        ${escapeHTML(item.sender)}
                    </div>

                    <div class="message-content">${escapeHTML(item.message)}</div>

                    <time class="message-time">
                        ${escapeHTML(time)}
                    </time>
                </article>
            `;
        }).join("");

        container.scrollTop = container.scrollHeight;

    } catch (error) {
        console.error("Chat loading error:", error);

        container.innerHTML = `
            <p class="empty-message">
                Ubutumwa ntibwashoboye kuza.
                Reba internet n'imiterere ya chat_messages muri Supabase.
            </p>
        `;
    }
}


// 10. REFRESH CHAT WHEN PERSON CHANGES

function setupChat() {
    const nameInput = getElement("personName");

    if (nameInput) {
        nameInput.addEventListener("change", loadMessages);
    }

    const messageForm = getElement("messageForm");

    if (messageForm) {
        messageForm.addEventListener("submit", sendMessage);
    }

    // Kuvugurura ubutumwa buri masegonda 7.
    // Ibi bifasha ibikoresho bitandukanye kubona ubutumwa bushya.
    setInterval(() => {
        const chatPage = getElement("messages");

        if (chatPage && chatPage.classList.contains("active")) {
            loadMessages();
        }
    }, 7000);
}


// 11. INITIALIZE APP

document.addEventListener("DOMContentLoaded", () => {
    setupNavigation();

    updateRotation();

    const riceForm = getElement("riceForm");

    if (riceForm) {
        riceForm.addEventListener("submit", saveRiceRecord);
    }

    const dateInput = getElement("riceDate");

    if (dateInput) {
        dateInput.addEventListener("change", updateRotation);
    }

    setupChat();

    loadRiceHistory();
});