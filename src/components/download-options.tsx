"use client";

import Image from 'next/image';
import { Download, Clapperboard, Music, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";

type Format = {
  quality: string;
  ext: string;
  url: string;
  has_audio: boolean;
  has_video: boolean;
  filesize: number | null;
  format_id?: string;
};

type DownloadOptionsProps = {
  info: {
    success: boolean;
    title: string;
    thumbnail: string;
    formats: Format[];
    isTiktok: boolean;
  };
};

const formatFileSize = (bytes: number | null | undefined): string => {
  if (bytes === null || bytes === undefined || bytes === 0) {
    return 'N/A';
  }
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Byte';
  const i = parseInt(String(Math.floor(Math.log(bytes) / Math.log(1024))));
  return Math.round(bytes / Math.pow(1024, i)) + ' ' + sizes[i];
};

export function DownloadOptions({ info }: DownloadOptionsProps) {
  const { toast } = useToast();
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  
  const videoFormats = info.formats
    .filter(f => f.has_video && !f.quality.includes('x'))
    .sort((a,b) => (b.filesize || 0) - (a.filesize || 0));
    
  const audioFormats = info.formats
    .filter(f => f.has_audio && !f.has_video && !f.quality.includes('Default'))
    .sort((a,b) => (b.filesize || 0) - (a.filesize || 0));
  
  const bestAudio = audioFormats.length > 0 ? audioFormats[0] : null;

  // --- Lógica Específica para TikTok ---
  const tiktokNoWatermarkVideo = info.isTiktok 
    ? info.formats.find(f => f.format_id === 'tiktok-nowm') 
    : null;
    
  const tiktokAudio = info.isTiktok
    ? info.formats.find(f => f.format_id === 'tiktok-audio')
    : null;


  const handleDownload = async (format: Format, action: 'video' | 'audio' | 'tiktok-mp3' | 'tiktok-video') => {
    setDownloadingUrl(format.url);

    try {
      const safeTitle = info.title.replace(/[/\\?%*:|"<>]/g, '-');

      if (action === 'audio' || action === 'tiktok-video') {
        toast({ title: 'Iniciando descarga...', description: 'Tu archivo se está preparando.' });
        const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(format.url)}&title=${encodeURIComponent(safeTitle)}&ext=${format.ext}`;

        const link = document.createElement('a');
        link.href = proxyUrl;
        link.setAttribute('download', `${safeTitle}.${format.ext}`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

      } else if (action === 'tiktok-mp3' && tiktokAudio) {
        toast({ title: 'Iniciando descarga de audio...', description: 'Tu archivo se está preparando.' });
        const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(tiktokAudio.url)}&title=${encodeURIComponent(safeTitle)}&ext=${tiktokAudio.ext}`;
        
        const link = document.createElement('a');
        link.href = proxyUrl;
        link.setAttribute('download', `${safeTitle}.${tiktokAudio.ext}`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

      } else if (action === 'video' && format.has_video && bestAudio) {
        toast({ title: 'Preparando descarga...', description: 'Uniendo video y audio. Esto puede tardar un momento.' });
        
        const response = await fetch('/api/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            videoUrl: format.url, 
            audioUrl: bestAudio.url,
            title: info.title,
            quality: format.quality,
            ext: format.ext
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Falló la unión del video en el servidor.');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `${safeTitle}.mkv`;
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
            if (filenameMatch && filenameMatch.length > 1) {
                filename = filenameMatch[1];
            }
        }
        
        a.download = filename;

        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        
        toast({ title: '¡Descarga completada!', description: 'El archivo se ha guardado en tu dispositivo.'});
      
      } else {
        throw new Error('No se encontró un formato de audio compatible para unir o la URL no es válida.');
      }
    } catch (error) {
       toast({
        variant: "destructive",
        title: "Error en la descarga",
        description: error instanceof Error ? error.message : "Ocurrió un error desconocido.",
       });
    } finally {
      setDownloadingUrl(null);
    }
  };

  const renderFormatTable = (formats: Format[], isAudioTab: boolean = false) => {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Calidad</TableHead>
            <TableHead>Formato</TableHead>
            <TableHead>Tamaño</TableHead>
            <TableHead className="text-right">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {formats.map((format, index) => {
            const isDownloading = downloadingUrl === format.url;
            return (
                <TableRow key={index}>
                <TableCell className="font-medium">
                    {format.quality}
                </TableCell>
                <TableCell>{format.ext}</TableCell>
                <TableCell>{formatFileSize(format.filesize)}</TableCell>
                <TableCell className="text-right">
                    <Button size="sm" onClick={() => handleDownload(format, isAudioTab ? 'audio' : 'video')} disabled={!!downloadingUrl}>
                    {isDownloading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Download className="mr-2 h-4 w-4" />
                    )}
                    {isDownloading ? 'Procesando...' : 'Descargar'}
                    </Button>
                </TableCell>
                </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };
  
  const renderTikTokContent = () => {
    return (
        <Tabs defaultValue="video" className="mt-4">
        <TabsList>
            <TabsTrigger value="video" disabled={!tiktokNoWatermarkVideo}>
            <Clapperboard className="mr-2 h-4 w-4" /> Video (Sin Marca)
            </TabsTrigger>
            <TabsTrigger value="audio" disabled={!tiktokAudio}>
            <Music className="mr-2 h-4 w-4" /> Audio
            </TabsTrigger>
        </TabsList>
        <TabsContent value="video" className="mt-4">
             {tiktokNoWatermarkVideo ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Calidad</TableHead>
                            <TableHead>Formato</TableHead>
                            <TableHead>Tamaño</TableHead>
                            <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell className="font-medium">{tiktokNoWatermarkVideo.quality}</TableCell>
                            <TableCell>{tiktokNoWatermarkVideo.ext}</TableCell>
                            <TableCell>{formatFileSize(tiktokNoWatermarkVideo.filesize)}</TableCell>
                            <TableCell className="text-right">
                                <Button size="sm" onClick={() => handleDownload(tiktokNoWatermarkVideo, 'tiktok-video')} disabled={!!downloadingUrl}>
                                    {downloadingUrl === tiktokNoWatermarkVideo.url ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                    {downloadingUrl === tiktokNoWatermarkVideo.url ? 'Descargando...' : 'Descargar'}
                                </Button>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
             ) : (
                <p className="text-muted-foreground text-center p-8">No se encontró una versión de video sin marca de agua.</p>
             )}
        </TabsContent>
        <TabsContent value="audio" className="mt-4">
            {tiktokAudio ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Calidad</TableHead>
                            <TableHead>Formato</TableHead>
                            <TableHead>Tamaño</TableHead>
                            <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell className="font-medium">{tiktokAudio.quality}</TableCell>
                            <TableCell>{tiktokAudio.ext}</TableCell>
                            <TableCell>{formatFileSize(tiktokAudio.filesize)}</TableCell>
                            <TableCell className="text-right">
                                <Button size="sm" onClick={() => handleDownload(tiktokAudio, 'tiktok-mp3')} disabled={!!downloadingUrl}>
                                    {downloadingUrl === tiktokAudio.url ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                    {downloadingUrl === tiktokAudio.url ? 'Descargando...' : 'Descargar'}
                                </Button>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            ) : (
                 <p className="text-muted-foreground text-center p-8">No se encontró una versión de solo audio.</p>
            )}
        </TabsContent>
        </Tabs>
    )
  }

  const renderDefaultContent = () => (
    <Tabs defaultValue="video" className="mt-4">
        <TabsList>
        <TabsTrigger value="video">
            <Clapperboard className="mr-2 h-4 w-4" /> Video
        </TabsTrigger>
        <TabsTrigger value="audio">
            <Music className="mr-2 h-4 w-4" /> Audio
        </TabsTrigger>
        </TabsList>
        <TabsContent value="video" className="mt-4">
        {videoFormats.length > 0 ? (
            renderFormatTable(videoFormats, false)
        ) : (
            <p className="text-muted-foreground text-center p-8">No hay formatos de video disponibles.</p>
        )}
        </TabsContent>
        <TabsContent value="audio" className="mt-4">
        {audioFormats.length > 0 ? (
            renderFormatTable(audioFormats, true)
        ) : (
            <p className="text-muted-foreground text-center p-8">No hay formatos de solo audio disponibles.</p>
        )}
        </TabsContent>
    </Tabs>
  );

  return (
    <Card className="w-full bg-white dark:bg-black/50 border-primary/20 shadow-xl animate-in fade-in-50 slide-in-from-bottom-5 duration-500">
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="md:w-1/3 lg:w-1/4">
            <Image
              src={info.thumbnail}
              alt={`Miniatura de ${info.title}`}
              width={320}
              height={180}
              className="rounded-lg object-cover w-full aspect-video"
            />
          </div>
          <div className="flex-1">
            <h2 className="text-lg md:text-xl font-bold line-clamp-2" title={info.title}>
              {info.title}
            </h2>

            {info.isTiktok ? renderTikTokContent() : renderDefaultContent()}
            
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
