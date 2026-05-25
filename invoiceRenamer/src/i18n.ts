import { invoke } from "@tauri-apps/api/core";

export type Locale = "en" | "fr";

type MessageKey =
  | "app.title"
  | "clearAll"
  | "selectPdfFiles"
  | "dropHint"
  | "addMoreFiles"
  | "processOneFile"
  | "processManyFiles"
  | "processingProgress"
  | "removeFileAria"
  | "cancelProcessing"
  | "cancelProcessingAria"
  | "status.pending"
  | "status.processing"
  | "status.done"
  | "status.error"
  | "pdfFilter"
  | "error.mistralApiKeyMissing"
  | "error.mistralChatNoFilename"
  | "error.invoiceInfoIncomplete"
  | "error.mistralApi"
  | "error.promptNotFound"
  | "error.pdfNoPages"
  | "error.noParentFolder"
  | "error.renameFailed"
  | "error.emptyFilename"
  | "error.fileNotFound"
  | "error.invalidFileName";

const messages: Record<Locale, Record<MessageKey, string>> = {
  en: {
    "app.title": "InvoiceRenamer",
    clearAll: "Clear all",
    selectPdfFiles: "Select PDF files",
    dropHint: "or drag and drop files here",
    addMoreFiles: "Add more files",
    processOneFile: "Process 1 file",
    processManyFiles: "Process {count} files",
    processingProgress: "Processing {current} of {total} \u00b7 {percent}%",
    removeFileAria: "Remove file",
    cancelProcessing: "Cancel",
    cancelProcessingAria: "Cancel processing",
    "status.pending": "Pending",
    "status.processing": "Processing",
    "status.done": "Done",
    "status.error": "Error",
    pdfFilter: "PDF",
    "error.mistralApiKeyMissing":
      "MISTRAL_API_KEY is not set. Add it to a .env file.",
    "error.mistralChatNoFilename":
      "Mistral chat response did not contain a filename.",
    "error.invoiceInfoIncomplete":
      "Could not extract all required invoice information.",
    "error.mistralApi": "Mistral API error ({status}): {message}",
    "error.promptNotFound":
      "prompt.txt not found. Place it at the project root.",
    "error.pdfNoPages": "PDF has no pages.",
    "error.noParentFolder": "Could not determine parent folder.",
    "error.renameFailed":
      "Could not rename {from} to {to}: {details}",
    "error.emptyFilename": "Generated filename is empty.",
    "error.fileNotFound": "File not found: {path}",
    "error.invalidFileName": "Invalid file name for path: {path}",
  },
  fr: {
    "app.title": "InvoiceRenamer",
    clearAll: "Tout effacer",
    selectPdfFiles: "S\u00e9lectionner des PDF",
    dropHint: "ou glissez-d\u00e9posez vos fichiers ici",
    addMoreFiles: "Ajouter des fichiers",
    processOneFile: "Traiter 1 fichier",
    processManyFiles: "Traiter {count} fichiers",
    processingProgress: "Traitement {current} sur {total} \u00b7 {percent}%",
    removeFileAria: "Retirer le fichier",
    cancelProcessing: "Annuler",
    cancelProcessingAria: "Annuler le traitement",
    "status.pending": "En attente",
    "status.processing": "En cours",
    "status.done": "Termin\u00e9",
    "status.error": "Erreur",
    pdfFilter: "PDF",
    "error.mistralApiKeyMissing":
      "MISTRAL_API_KEY n'est pas d\u00e9finie. Ajoutez-la dans un fichier .env.",
    "error.mistralChatNoFilename":
      "La r\u00e9ponse Mistral ne contient pas de nom de fichier.",
    "error.invoiceInfoIncomplete":
      "Impossible d'extraire toutes les informations requises de la facture.",
    "error.mistralApi": "Erreur API Mistral ({status}) : {message}",
    "error.promptNotFound":
      "prompt.txt introuvable. Placez-le \u00e0 la racine du projet.",
    "error.pdfNoPages": "Le PDF ne contient aucune page.",
    "error.noParentFolder": "Impossible de d\u00e9terminer le dossier parent.",
    "error.renameFailed":
      "Impossible de renommer {from} en {to} : {details}",
    "error.emptyFilename": "Le nom de fichier g\u00e9n\u00e9r\u00e9 est vide.",
    "error.fileNotFound": "Fichier introuvable : {path}",
    "error.invalidFileName": "Nom de fichier invalide pour le chemin : {path}",
  },
};

type FileStatus = "pending" | "processing" | "done" | "error";

const statusKeys: Record<FileStatus, MessageKey> = {
  pending: "status.pending",
  processing: "status.processing",
  done: "status.done",
  error: "status.error",
};

let cachedLocale: Locale | null = null;

function localeFromLanguageTag(language: string): Locale {
  return language.toLowerCase().startsWith("fr") ? "fr" : "en";
}

function localeFromNavigator(): Locale {
  const candidates = [navigator.language, ...(navigator.languages ?? [])];

  for (const language of candidates) {
    if (language.toLowerCase().startsWith("fr")) {
      return "fr";
    }
  }

  return "en";
}

export async function initLocale(): Promise<void> {
  try {
    const systemLocale = await invoke<string>("get_system_locale");
    cachedLocale = localeFromLanguageTag(systemLocale);
  } catch {
    cachedLocale = localeFromNavigator();
  }
}

export function getLocale(): Locale {
  return cachedLocale ?? localeFromNavigator();
}

export function t(
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const locale = getLocale();
  let text = messages[locale][key] ?? messages.en[key] ?? key;

  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(`{${name}}`, String(value));
    }
  }

  return text;
}

export function statusText(status: FileStatus): string {
  return t(statusKeys[status]);
}

const backendErrorKeys: Record<string, MessageKey> = {
  "error.mistral_api_key_missing": "error.mistralApiKeyMissing",
  "error.mistral_chat_no_filename": "error.mistralChatNoFilename",
  "error.invoice_info_incomplete": "error.invoiceInfoIncomplete",
  "error.prompt_not_found": "error.promptNotFound",
  "error.pdf_no_pages": "error.pdfNoPages",
  "error.no_parent_folder": "error.noParentFolder",
  "error.empty_filename": "error.emptyFilename",
};

export function translateBackendError(message: string): string {
  if (message.startsWith("error.mistral_api|")) {
    const parts = Object.fromEntries(
      message
        .slice("error.mistral_api|".length)
        .split("|")
        .map((part) => part.split("=", 2) as [string, string]),
    );
    return t("error.mistralApi", {
      status: parts.status ?? "?",
      message: parts.message ?? message,
    });
  }

  if (message.startsWith("error.rename_failed|")) {
    const parts = Object.fromEntries(
      message
        .slice("error.rename_failed|".length)
        .split("|")
        .map((part) => part.split("=", 2) as [string, string]),
    );
    return t("error.renameFailed", {
      from: parts.from ?? "?",
      to: parts.to ?? "?",
      details: parts.details ?? message,
    });
  }

  if (message.startsWith("error.file_not_found|")) {
    return t("error.fileNotFound", {
      path: message.slice("error.file_not_found|".length),
    });
  }

  if (message.startsWith("error.invalid_file_name|")) {
    return t("error.invalidFileName", {
      path: message.slice("error.invalid_file_name|".length),
    });
  }

  const mappedKey = backendErrorKeys[message];
  if (mappedKey) {
    return t(mappedKey);
  }

  return message;
}

export function applyDocumentLocale(): void {
  document.documentElement.lang = getLocale();
  document.title = t("app.title");
}
