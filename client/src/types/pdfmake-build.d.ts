declare module "pdfmake/build/pdfmake" {
  type PdfInstance = {
    download: (filename?: string) => void;
    getBlob: (callback: (blob: Blob) => void) => void;
  };

  type PdfMakeRuntime = {
    vfs?: Record<string, string>;
    createPdf: (definition: unknown) => PdfInstance;
  };

  const pdfMake: PdfMakeRuntime;
  export default pdfMake;
}

declare module "pdfmake/build/vfs_fonts" {
  type PdfFontVfs = Record<string, string>;
  const fonts:
    | PdfFontVfs
    | { vfs?: PdfFontVfs; pdfMake?: { vfs?: PdfFontVfs } };
  export default fonts;
}
