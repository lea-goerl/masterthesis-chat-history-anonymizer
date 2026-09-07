import { useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileArchive, HelpCircle, Maximize } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  isLoading: boolean;
  onNeedHelp?: () => void;
}

export const FileUpload = ({ onFileUpload, isLoading, onNeedHelp }: FileUploadProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFullscreen = () => {
    const v = videoRef.current as any;
    if (!v) return;
    if (v.requestFullscreen) v.requestFullscreen();
    else if (v.webkitRequestFullscreen) v.webkitRequestFullscreen();
    else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); // Safari / iOS
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileUpload(acceptedFiles[0]);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip']
    },
    maxFiles: 1,
    disabled: isLoading
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 lg:col-span-2">
        <p className="text-sm text-red-700">
          If you did not receive your data export from ChatGPT yet, please return the study and
          contact the researchers. We can then invite you to a second iteration later on.
        </p>
      </div>

      {/* Left column: how to export */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground">
          1. Go to ChatGPT to export your chat history
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Please go to your ChatGPT account, click on <i>Settings</i>, then <i>Data Controls</i>, and{" "}
          <i>Export Data</i>. Click on the <i>Export</i> button. This link takes you directly there:{" "}
          <a href="https://chatgpt.com/#settings/DataControls" target="_blank" rel="noreferrer" className="text-primary hover:underline">
            https://chatgpt.com/#settings/DataControls
          </a>
        </p>

        <h3 className="text-lg font-semibold text-foreground">
          2. Check your emails – download the file
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          You will then receive an email. This usually happens immediately – you do not have to wait
          24 hours. Click the link in the email to download your ChatGPT history file.
        </p>

        <video
          ref={videoRef}
          src="expl_videos/chatgpt_instr_merged.mp4"
          className="mx-auto block w-full max-w-xs rounded-lg border border-border"
          autoPlay
          muted
          loop
          playsInline
        ></video>
        <div className="mt-2 flex justify-center">
          <Button variant="ghost" size="sm" onClick={handleFullscreen}>
            <Maximize className="mr-2 h-4 w-4" />
            View fullscreen
          </Button>
        </div>
      </Card>

      {/* Right column: upload */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground">
          3. Upload the downloaded ZIP file here
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Drag and drop or select the ZIP file you just downloaded from ChatGPT:
        </p>

        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-border bg-card hover:border-primary/50 hover:bg-muted/50'
          }`}
        >
          <input {...getInputProps()} />

          <div className="flex flex-col items-center gap-4">
            {isLoading ? (
              <>
                <FileArchive className="h-16 w-16 animate-pulse text-primary" />
                <div>
                  <p className="text-lg font-semibold text-foreground">Processing ZIP file...</p>
                  <p className="text-sm text-muted-foreground">This may take a moment</p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-full bg-primary/10 p-4">
                  <Upload className="h-12 w-12 text-primary" />
                </div>

                <div>
                  <p className="mb-1 text-lg font-semibold text-foreground">
                    {isDragActive ? 'Drop your ZIP file here' : 'Upload ChatGPT Export'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Drag &amp; drop or click to select your ZIP file
                  </p>
                </div>

                <div className="mt-2 rounded-lg bg-muted px-4 py-2">
                  <p className="text-xs text-muted-foreground">
                    Supports ChatGPT personal data export ZIP files
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {onNeedHelp && (
          <div className="mt-5 border-t border-border pt-4 text-center">
            <p className="mb-2 text-sm text-muted-foreground">
              Still waiting for your export or having trouble?
            </p>
            <Button variant="outline" className="w-full" onClick={onNeedHelp}>
              <HelpCircle className="mr-2 h-4 w-4" />
              I haven't received my ChatGPT export yet
            </Button>
          </div>
        )}
      </Card>

      <p className="text-center text-xs text-muted-foreground lg:col-span-2">
        Developed and provided by researchers at LMU Munich
      </p>
    </div>
  );
};
