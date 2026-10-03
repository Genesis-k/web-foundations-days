let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" }
];

function searchNotes(word) {
  const query = word.toLowerCase();
  return notes.filter(note => note.text.toLowerCase().includes(query));
}

function longestNote() {
  if (notes.length === 0) {
    return null;
  }

  return notes.reduce((longest, current) => {
    return current.text.length > longest.text.length ? current : longest;
  });
}

function countByCategory() {
  const counts = {};
  for (const note of notes) {
    counts[note.category] = (counts[note.category] || 0) + 1;
  }
  return counts;
}

function getSummary() {
  const total = notes.length;
  const label = total === 1 ? "note" : "notes";
  const counts = countByCategory();

  if (total === 0) {
    return "0 notes.";
  }

  const breakdown = Object.entries(counts)
    .map(([category, count]) => `${count} ${category}`)
    .join(", ");

  return `${total} ${label}: ${breakdown}.`;
}

function isDuplicate(text) {
  const cleanedText = text.trim().toLowerCase();
  return notes.some(note => note.text.trim().toLowerCase() === cleanedText);
}

function addNote(text, category) {
  const validCategories = ["personal", "work", "study"];
  const trimmedText = text.trim();

  if (trimmedText.length < 1 || trimmedText.length > 200) {
    console.log("Failed to add note: Note text must be between 1 and 200 characters.");
    return false;
  }

  if (!validCategories.includes(category)) {
    console.log(`Failed to add note: Category must be "personal", "work", or "study". Received "${category}".`);
    return false;
  }

  if (isDuplicate(trimmedText)) {
    console.log(`Failed to add note: A note with the text "${trimmedText}" already exists.`);
    return false;
  }

  const nextId = notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1;
  notes.push({
    id: nextId,
    text: trimmedText,
    category: category
  });

  return true;
}

console.log(searchNotes("report"));
console.log(searchNotes("nonexistent keyword"));

console.log(longestNote());
const savedNotes = [...notes];
notes = [];
console.log(longestNote());
notes = savedNotes;

console.log(countByCategory());
notes = [{ id: 1, text: "Just one task", category: "work" }];
console.log(countByCategory());
notes = savedNotes;

console.log(getSummary());
notes = [{ id: 1, text: "Only item", category: "personal" }];
console.log(getSummary());
notes = savedNotes;

console.log(isDuplicate("   CALL MUM   "));
console.log(isDuplicate("Prepare for Day 4"));

console.log(addNote("Prepare for Day 4", "study"));
console.log(addNote("Call mum", "personal"));
console.log(addNote("   ", "personal"));
console.log(addNote("Read documentation", "leisure"));