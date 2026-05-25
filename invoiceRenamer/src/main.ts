import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";

type FileStatus = "pending";

interface FileEntry {
  id: string;
  path: string;
  name: string;
  size: number;
  status: FileStatus;
}

interface FileInfo {
  path: string;
  name: string;
  size: number;
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

let files: FileEntry[] = [];
let draggedFileId: string | null = null;

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

function statusLabel(status: FileStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function processButtonLabel(count: number): string {
  return count === 1 ? "Process 1 file" : `Process ${count} files`;
}

function updateProcessButton() {
  const count = files.length;
  processButton.textContent = processButtonLabel(count);
  processButton.disabled = count === 0;
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
    item.draggable = true;

    item.innerHTML = `
      <div class="file-item__info">
        <p class="file-item__name" title="${file.path}">${file.name}</p>
        <p class="file-item__meta">
          <span>${formatFileSize(file.size)}</span>
          <span>${statusLabel(file.status)}</span>
        </p>
      </div>
      <button class="file-item__remove" type="button" aria-label="Remove file">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    `;

    item.querySelector(".file-item__remove")?.addEventListener("click", () => {
      removeFile(file.id);
    });

    item.addEventListener("dragstart", (event) => {
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
  files = files.filter((file) => file.id !== fileId);
  renderFileList();
}

function clearAllFiles() {
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
  }));

  files = [...files, ...newEntries];
  renderFileList();
}

async function selectFiles() {
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

function setDropZoneActive(active: boolean) {
  const hasFiles = files.length > 0;
  const targetZone = hasFiles ? addMoreZone : uploadZone;

  targetZone.classList.toggle("drop-panel--active", active);
}

window.addEventListener("DOMContentLoaded", async () => {
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
    if (files.length === 0) {
      return;
    }
    // Processing logic will be wired up here
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
