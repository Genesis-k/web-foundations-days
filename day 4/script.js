// 1. ELEMENT SELECTIONS
const noteText = document.getElementById("note-text");
const charCount = document.getElementById("char-count");
const wordCount = document.getElementById("word-count");
const clearBtn = document.getElementById("clear-btn");
const themeToggle = document.getElementById("theme-toggle");


// 2. COUNTER & WARNING UPDATE FUNCTION

function updateCounts() {
  const text = noteText.value;
  const numChars = text.length;

  // Calculate words (ignore empty or whitespace-only strings)
  const trimmedText = text.trim();
  const numWords = trimmedText === "" ? 0 : trimmedText.split(/\s+/).length;

  // Display counters
  charCount.textContent = `${numChars} / 200 characters`;
  wordCount.textContent = `${numWords} words`;

  // Apply warning/over classes
  charCount.classList.remove("warning", "over");
  if (numChars > 200) {
    charCount.classList.add("over");
  } else if (numChars > 180) {
    charCount.classList.add("warning");
  }
}

// 3. DRAFT MANAGEMENT (LOCALSTORAGE)
function saveDraft() {
  localStorage.setItem("note_draft", noteText.value);
}

function restoreDraft() {
  const savedDraft = localStorage.getItem("note_draft");
  if (savedDraft !== null) {
    noteText.value = savedDraft;
  }
}

function clearEverything() {
  noteText.value = "";
  localStorage.removeItem("note_draft");
  updateCounts();
}
// 4. THEME MANAGEMENT (LOCALSTORAGE)

function applyTheme(theme) {
  if (theme === "dark") {
    document.body.classList.add("dark");
    themeToggle.textContent = "Light mode";
  } else {
    document.body.classList.remove("dark");
    themeToggle.textContent = "Dark mode";
  }
  localStorage.setItem("note_theme", theme);
}

function toggleTheme() {
  const isDark = document.body.classList.contains("dark");
  applyTheme(isDark ? "light" : "dark");
}

function restoreTheme() {
  const savedTheme = localStorage.getItem("note_theme") || "light";
  applyTheme(savedTheme);
}

// 5. EVENT LISTENERS

noteText.addEventListener("input", () => {
  updateCounts();
  saveDraft();
});

noteText.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearEverything();
  }
});

clearBtn.addEventListener("click", clearEverything);
themeToggle.addEventListener("click", toggleTheme);

// 6. INITIALIZATION ON LOAD
restoreTheme();
restoreDraft();
updateCounts();