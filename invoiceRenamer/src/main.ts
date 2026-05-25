import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";

type FileStatus = "pending" | "processing" | "done" | "error";

interface FileEntry {
  id: string;
  path: string;
  name: string;
  previousName?: string;
  size: number;
  status: FileStatus;
  progress: number;
  error?: string;
}

interface FileInfo {
  path: string;
  name: string;
  size: number;
}

interface ProcessProgressEvent {
  path: string;
  status: FileStatus;
  progress: number;
  newPath?: string;
  newName?: string;
  error?: string;
  completedCount?: number;
  totalCount?: number;
}

const dropZone = document.querySelector<HTMLElement>("#dropZone")!;
const dropZoneContent = document.querySelector<HTMLElement>("#dropZoneContent")!;
const filesView = document.querySelector<HTMLElement>("#filesView")!;
const fileListEl = document.querySelector<HTMLUListElement>("#fileList")!;
const uploadZone = document.querySelector<HTMLElement>("#uploadZone")!;
const addMoreZone = document.querySelector<HTMLElement>("#addMoreZone")!;
const selectButton = document.querySelector<HTMLButtonElement>("#selectButton")!;
const addMoreButton = document.querySelector<HTMLButtonElement>("#addMoreButton")!;
const clearAllButton = document.querySelector<HTMLButtonElement>("#clearAllButton")!;
const processButton = document.querySelector<HTMLButtonElement>("#processButton")!;
const processButtonFill = document.querySelector<HTMLElement>("#processButtonFill")!;
const processButtonLabel = document.querySelector<HTMLElement>("#processButtonLabel")!;

let files: FileEntry[] = [];
let draggedFileId: string | null = null;
let isProcessing = false;
let batchTotal = 0;
let batchCompleted = 0;

function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function statusLabel(file: FileEntry): string {
  if (file.status === "error" && file.error) {
    return file.error;
  }

  return file.status.charAt(0).toUpperCase() + file.status.slice(1);
}

function getGlobalProgressPercent(): number {
  if (!isProcessing || batchTotal === 0) {
    return 0;
  }

  const processingFile = files.find((file) => file.status === "processing");
  const currentFileProgress = processingFile?.progress ?? 0;
  const completedBeforeCurrent = processingFile ? batchCompleted : batchTotal;

  return Math.min(
    100,
    Math.round(((completedBeforeCurrent * 100) + currentFileProgress) / batchTotal),
  );
}

function updateProcessButton() {
  const pendingCount = files.filter((file) => file.status === "pending").length;
  const hasPending = pendingCount > 0;
  const globalPercent = getGlobalProgressPercent();

  processButton.classList.toggle("process-button--processing", isProcessing);

  if (isProcessing && batchTotal > 0) {
    processButtonLabel.textContent = `Cancel · ${globalPercent}%`;
    processButtonFill.style.width = `${globalPercent}%`;
  } else {
    processButtonLabel.textContent =
      pendingCount === 1 ? "Process 1 file" : `Process ${pendingCount || files.length} files`;
    processButtonFill.style.width = "0%";
  }

  processButton.disabled = !hasPending && !isProcessing;
  clearAllButton.disabled = isProcessing;
  addMoreButton.disabled = isProcessing;
  selectButton.disabled = isProcessing;
}

function applyProgressUpdate(event: ProcessProgressEvent) {
  const file = files.find((entry) => entry.path === event.path);
  if (!file) {
    return;
  }

  file.status = event.status;
  file.progress = event.progress;

  if (event.status === "pending") {
    file.error = undefined;
  }

  if (event.totalCount !== undefined) {
    batchTotal = event.totalCount;
  }

  if (event.completedCount !== undefined) {
    batchCompleted = event.completedCount;
  }

  if (event.newPath) {
    file.path = event.newPath;
  }

  if (event.newName && event.newName !== file.name) {
    file.previousName = file.previousName ?? file.name;
    file.name = event.newName;
  }

  if (event.error) {
    file.error = event.error;
  }

  renderFileList();
  updateProcessButton();
}

function fileProgressBarHtml(file: FileEntry): string {
  if (file.status === "pending") {
    return "";
  }

  const modifier =
    file.status === "done"
      ? "progress-bar--done"
      : file.status === "error"
        ? "progress-bar--error"
        : "progress-bar--active";

  return `
    <div class="progress-bar progress-bar--file ${modifier}">
      <div class="progress-bar__fill" style="width: ${file.progress}%"></div>
    </div>
  `;
}

function fileNameHtml(file: FileEntry): string {
  if (file.previousName && file.previousName !== file.name) {
    return `
      <span class="file-item__rename">
        <span class="file-item__name-old">${file.previousName}</span>
        <span class="file-item__rename-arrow" aria-hidden="true">→</span>
        <span class="file-item__name-new">${file.name}</span>
      </span>
    `;
  }

  return `<span class="file-item__name-current">${file.name}</span>`;
}

function renderFileList() {
  const hasFiles = files.length > 0;

  dropZoneContent.classList.toggle("hidden", hasFiles);
  filesView.classList.toggle("hidden", !hasFiles);
  dropZone.classList.toggle("drop-zone--filled", hasFiles);

  fileListEl.innerHTML = "";

  files.forEach((file) => {
    const item = document.createElement("li");
    item.className = "file-item";
    item.dataset.fileId = file.id;
    item.draggable = !isProcessing;

    item.innerHTML = `
      <div class="file-item__info">
        <p class="file-item__name" title="${file.path}">${fileNameHtml(file)}</p>
        <p class="file-item__meta">
          <span>${formatFileSize(file.size)}</span>
          <span class="file-item__status file-item__status--${file.status}">${statusLabel(file)}</span>
        </p>
        ${fileProgressBarHtml(file)}
      </div>
      <button class="file-item__remove" type="button" aria-label="Remove file" ${isProcessing ? "disabled" : ""}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    `;

    item.querySelector(".file-item__remove")?.addEventListener("click", () => {
      removeFile(file.id);
    });

    item.addEventListener("dragstart", (event) => {
      if (isProcessing) {
        event.preventDefault();
        return;
      }

      draggedFileId = file.id;
      item.classList.add("file-item--dragging");
      event.dataTransfer?.setData("text/plain", file.id);
      event.dataTransfer!.effectAllowed = "move";
    });

    item.addEventListener("dragend", () => {
      draggedFileId = null;
      item.classList.remove("file-item--dragging");
      fileListEl.querySelectorAll(".file-item--drag-over").forEach((el) => {
        el.classList.remove("file-item--drag-over");
      });
    });

    item.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (draggedFileId && draggedFileId !== file.id) {
        item.classList.add("file-item--drag-over");
      }
    });

    item.addEventListener("dragleave", () => {
      item.classList.remove("file-item--drag-over");
    });

    item.addEventListener("drop", (event) => {
      event.preventDefault();
      item.classList.remove("file-item--drag-over");

      if (!draggedFileId || draggedFileId === file.id) {
        return;
      }

      reorderFile(draggedFileId, file.id);
    });

    fileListEl.appendChild(item);
  });

  updateProcessButton();
}

function reorderFile(sourceId: string, targetId: string) {
  const sourceIndex = files.findIndex((file) => file.id === sourceId);
  const targetIndex = files.findIndex((file) => file.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1) {
    return;
  }

  const [movedFile] = files.splice(sourceIndex, 1);
  files.splice(targetIndex, 0, movedFile);
  renderFileList();
}

function removeFile(fileId: string) {
  if (isProcessing) {
    return;
  }

  files = files.filter((file) => file.id !== fileId);
  renderFileList();
}

function clearAllFiles() {
  if (isProcessing) {
    return;
  }

  files = [];
  renderFileList();
}

async function addFilesFromPaths(paths: string[]) {
  const pdfPaths = paths.filter((path) => path.toLowerCase().endsWith(".pdf"));
  if (pdfPaths.length === 0) {
    return;
  }

  const existingPaths = new Set(files.map((file) => file.path));
  const newPaths = pdfPaths.filter((path) => !existingPaths.has(path));
  if (newPaths.length === 0) {
    return;
  }

  const fileInfos = await invoke<FileInfo[]>("get_files_info", { paths: newPaths });

  const newEntries: FileEntry[] = fileInfos.map((info) => ({
    id: crypto.randomUUID(),
    path: info.path,
    name: info.name,
    size: info.size,
    status: "pending",
    progress: 0,
  }));

  files = [...files, ...newEntries];
  renderFileList();
}

async function selectFiles() {
  if (isProcessing) {
    return;
  }

  const selected = await open({
    multiple: true,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });

  if (!selected) {
    return;
  }

  const paths = Array.isArray(selected) ? selected : [selected];
  await addFilesFromPaths(paths);
}

async function processFiles() {
  if (isProcessing) {
    await invoke("cancel_processing");
    return;
  }

  const pendingFiles = files.filter((file) => file.status === "pending");
  if (pendingFiles.length === 0) {
    return;
  }

  isProcessing = true;
  batchTotal = pendingFiles.length;
  batchCompleted = 0;
  pendingFiles.forEach((file) => {
    file.progress = 0;
  });
  updateProcessButton();

  try {
    await invoke("process_invoices", {
      paths: pendingFiles.map((file) => file.path),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pendingFiles.forEach((file) => {
      file.status = "error";
      file.error = message;
    });
    renderFileList();
  } finally {
    isProcessing = false;
    batchTotal = 0;
    batchCompleted = 0;
    updateProcessButton();
  }
}

function setDropZoneActive(active: boolean) {
  if (isProcessing) {
    return;
  }

  const hasFiles = files.length > 0;
  const targetZone = hasFiles ? addMoreZone : uploadZone;

  targetZone.classList.toggle("drop-panel--active", active);
}

window.addEventListener("DOMContentLoaded", async () => {
  await listen<ProcessProgressEvent>("process-progress", (event) => {
    applyProgressUpdate(event.payload);
  });

  await listen("process-cancelled", () => {
    files.forEach((file) => {
      if (file.status === "processing") {
        file.status = "pending";
        file.progress = 0;
        file.error = undefined;
      }
    });
    renderFileList();
  });

  selectButton.addEventListener("click", () => {
    void selectFiles();
  });

  addMoreButton.addEventListener("click", () => {
    void selectFiles();
  });

  clearAllButton.addEventListener("click", () => {
    clearAllFiles();
  });

  processButton.addEventListener("click", () => {
    void processFiles();
  });

  const appWindow = getCurrentWindow();
  await appWindow.onDragDropEvent((event) => {
    if (event.payload.type === "over") {
      setDropZoneActive(true);
      return;
    }

    if (event.payload.type === "leave") {
      setDropZoneActive(false);
      return;
    }

    if (event.payload.type === "drop") {
      setDropZoneActive(false);
      void addFilesFromPaths(event.payload.paths);
    }
  });

  renderFileList();
});
