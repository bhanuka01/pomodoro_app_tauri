// Pomodoro App Logic

// State
let state = {
  timer: 25 * 60, // seconds
  isRunning: false,
  timerInterval: null,
  tasks: [],
  activeTaskId: null,
  history: [],
  audioContext: null,
  oscillator: null,
  isAlarmPlaying: false,
};

// DOM Elements
const timerDisplay = document.getElementById("timer-display");
const timerLabel = document.getElementById("timer-label");
const timerProgress = document.querySelector(".timer-progress"); // SVG Circle

const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("pause-btn");
const resetBtn = document.getElementById("reset-btn");

const taskListEl = document.getElementById("task-list");
const newTaskInput = document.getElementById("new-task-input");
const addTaskBtn = document.getElementById("add-task-btn");
const tasksCountEl = document.getElementById("tasks-count");

const statToday = document.getElementById("stat-today");

// Constants
const POMODORO_TIME = 25 * 60;

// Init
window.addEventListener("DOMContentLoaded", () => {
  loadData();
  renderTimer();
  renderTasks();
  renderStats();
});

// Timer Logic
function startTimer() {
  if (state.isRunning) return;

  if (state.timer === 0) {
    state.timer = POMODORO_TIME;
  }

  state.isRunning = true;
  updateControls();
  timerLabel.textContent = "FOCUSING...";

  // Request audio context on user gesture if needed
  if (!state.audioContext) {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  state.timerInterval = setInterval(() => {
    if (state.timer > 0) {
      state.timer--;
      renderTimer();
    } else {
      completeSession();
    }
  }, 1000);
}

function pauseTimer() {
  state.isRunning = false;
  clearInterval(state.timerInterval);
  updateControls();
  timerLabel.textContent = "PAUSED";
}

function resetTimer() {
  pauseTimer();
  stopAlarm();
  state.timer = POMODORO_TIME;
  renderTimer();
  timerLabel.textContent = "READY";
}

function completeSession() {
  pauseTimer();
  state.timer = 0;

  // Save Session
  const session = {
    date: new Date().toISOString(),
    duration: 25,
    taskId: state.activeTaskId
  };
  state.history.push(session);
  saveData();

  playAlarm();
  renderStats();
  renderTimer();
  timerLabel.textContent = "COMPLETED";
}

// Alarm Logic
function playAlarm() {
  if (state.isAlarmPlaying) return;
  state.isAlarmPlaying = true;

  // Create oscillator
  const osc = state.audioContext.createOscillator();
  const gainNode = state.audioContext.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, state.audioContext.currentTime);

  state.oscillator = osc;
  osc.connect(gainNode);
  gainNode.connect(state.audioContext.destination);
  osc.start();

  // Pattern: Beep-Beep... 
  // For simplicity, just a pulsed beep loop
  state.alarmInterval = setInterval(() => {
    if (!state.isAlarmPlaying) {
      clearInterval(state.alarmInterval);
      return;
    }
    const t = state.audioContext.currentTime;
    gainNode.gain.setValueAtTime(0.1, t);
    gainNode.gain.linearRampToValueAtTime(0, t + 0.1);
  }, 500);

  // Auto stop after 5s if user doesn't
  setTimeout(stopAlarm, 5000);
}

function stopAlarm() {
  if (!state.isAlarmPlaying) return;
  state.isAlarmPlaying = false;
  if (state.oscillator) {
    try {
      state.oscillator.stop();
      state.oscillator.disconnect();
    } catch (e) { }
    state.oscillator = null;
  }
}

function updateControls() {
  if (state.isRunning) {
    startBtn.style.display = "none";
    pauseBtn.style.display = "inline-flex";
  } else {
    startBtn.style.display = "inline-flex";
    pauseBtn.style.display = "none";
  }
}

function renderTimer() {
  const minutes = Math.floor(state.timer / 60);
  const seconds = state.timer % 60;
  timerDisplay.textContent = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;

  document.title = `${timerDisplay.textContent} - Focus`;

  // Update Circle Progress
  // pathLength is 1. Offset 0 = full, 1 = empty.
  // We want it to decrease. 
  const total = POMODORO_TIME;
  const progress = (total - state.timer) / total;
  // progress goes 0 -> 1
  // stroke-dashoffset: 1 means empty (hidden). 0 means full.
  // If we want it to "drain": start at 0, go to 1.
  timerProgress.style.strokeDashoffset = progress;
}

// Task Logic
function addTask() {
  const text = newTaskInput.value.trim();
  if (!text) return;

  const task = {
    id: crypto.randomUUID(),
    text: text,
    isDone: false,
    createdAt: new Date().toISOString()
  };

  state.tasks.push(task);
  newTaskInput.value = "";
  saveData();
  renderTasks();
}

function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (task) {
    task.isDone = !task.isDone;
    saveData();
    renderTasks();
  }
}

function deleteTask(id, e) {
  e.stopPropagation();
  state.tasks = state.tasks.filter(t => t.id !== id);
  if (state.activeTaskId === id) state.activeTaskId = null;
  saveData();
  renderTasks();
}

function selectTask(id) {
  state.activeTaskId = id;
  saveData();
  renderTasks();
}

function renderTasks() {
  taskListEl.innerHTML = "";

  // Sort: Not done first, then done
  const sortedTasks = [...state.tasks].sort((a, b) => a.isDone === b.isDone ? 0 : a.isDone ? 1 : -1);

  sortedTasks.forEach(task => {
    const li = document.createElement("li");
    li.className = `task-item ${state.activeTaskId === task.id ? "active" : ""} ${task.isDone ? "done" : ""}`;
    li.onclick = () => selectTask(task.id);

    // Checkbox
    const checkbox = document.createElement("button");
    checkbox.className = "task-checkbox";
    checkbox.onclick = (e) => {
      e.stopPropagation();
      toggleTask(task.id);
    };

    const span = document.createElement("span");
    span.className = "task-text";
    span.textContent = task.text;

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>`;
    delBtn.onclick = (e) => deleteTask(task.id, e);

    li.appendChild(checkbox);
    li.appendChild(span);
    li.appendChild(delBtn);
    taskListEl.appendChild(li);
  });

  tasksCountEl.textContent = state.tasks.filter(t => !t.isDone).length;
}

// Stats Logic
function renderStats() {
  const today = new Date();

  // Calculate Today
  const todayMinutes = state.history
    .filter(s => {
      const d = new Date(s.date);
      return d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();
    })
    .reduce((acc, curr) => acc + curr.duration, 0);

  // Render text
  statToday.textContent = formatTime(todayMinutes);
}

function formatTime(minutes) {
  if (minutes < 60) return `${minutes}m`;
  return `${(minutes / 60).toFixed(1)}h`;
}

// Data Persistence
function saveData() {
  localStorage.setItem("pomodoro_tasks", JSON.stringify(state.tasks));
  localStorage.setItem("pomodoro_history", JSON.stringify(state.history));
  localStorage.setItem("pomodoro_active_task", state.activeTaskId);
}

function loadData() {
  const tasks = localStorage.getItem("pomodoro_tasks");
  const history = localStorage.getItem("pomodoro_history");
  const activeTask = localStorage.getItem("pomodoro_active_task");

  if (tasks) state.tasks = JSON.parse(tasks);
  if (history) state.history = JSON.parse(history);
  if (activeTask) state.activeTaskId = activeTask;
}

// Event Listeners
startBtn.addEventListener("click", startTimer);
pauseBtn.addEventListener("click", pauseTimer);
resetBtn.addEventListener("click", resetTimer);
addTaskBtn.addEventListener("click", addTask);
newTaskInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addTask();
});

// Theme Toggle (Optional, minimal implementation)
// const themeToggle = document.getElementById('theme-toggle');
// themeToggle.onclick = () => {
//   // toggle class
// }
