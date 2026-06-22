import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileArchive, ArrowRight, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

interface UploadSectionProps {
  onUploadSuccess: (data: any) => void;
}

export default function UploadSection({ onUploadSuccess }: UploadSectionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    setError(null);
    if (!file.name.endsWith('.zip')) {
      setError("Please upload a .zip file containing the repository.");
      return;
    }

    setIsUploading(true);
    try {
      const data = await api.uploadRepo(file);
      onUploadSuccess(data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "An error occurred during upload. Please ensure the backend is running.");
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto text-center mt-20">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mb-8"
      >
        <h2 className="text-4xl font-bold mb-4 tracking-tight">
          Secure Your Banking Code
        </h2>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Upload a source code repository to automatically scan for zero-days, compliance violations, and generate AI insights.
        </p>
      </motion.div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={cn(
          "glass-panel rounded-2xl p-12 border-2 border-dashed transition-all cursor-pointer group relative overflow-hidden",
          isDragging ? "border-primary bg-primary/10 scale-[1.02]" : "border-border hover:border-primary/50 hover:bg-white/5",
          isUploading && "opacity-80 cursor-not-allowed pointer-events-none"
        )}
      >
        {isUploading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-2xl">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-lg font-medium text-white">Initializing DevSecOps Pipeline...</p>
          </div>
        )}

        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileInput}
          accept=".zip"
          className="hidden" 
        />
        
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <FileArchive className="w-10 h-10 text-primary" />
          </div>
        </div>
        
        <h3 className="text-xl font-semibold text-white mb-2">
          Drag & Drop your .zip repository
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          or click to browse from your computer
        </p>
        
        <div className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-full font-medium hover:bg-primary/90 transition-colors">
          <Upload className="w-4 h-4" />
          Select Repository
        </div>
      </div>

      {error && (
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-danger mt-4 text-sm font-medium"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}
