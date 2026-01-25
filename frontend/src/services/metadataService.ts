import ExifReader from 'exifreader';

export interface PhotoMetadata {
  dateTaken?: string;
  cameraModel?: string;
  latitude?: number;
  longitude?: number;
  originalWidth?: number;
  originalHeight?: number;
  software?: string;
}

export async function extractPhotoMetadata(file: File): Promise<PhotoMetadata> {
  try {
    const tags = await ExifReader.load(file);
    return parseTags(tags);
  } catch (err) {
    console.warn('Failed to extract EXIF metadata from file:', err);
    return {};
  }
}

export async function extractFromBuffer(buffer: any): Promise<PhotoMetadata> {
  try {
    const tags = await ExifReader.load(buffer);
    return parseTags(tags);
  } catch (err) {
    console.warn('Failed to extract EXIF metadata from buffer:', err);
    return {};
  }
}

function parseTags(tags: any): PhotoMetadata {
  const dateTag = tags['DateTimeOriginal'] || tags['DateTime'];
  let dateTaken: string | undefined;
  
  if (dateTag && dateTag.description) {
    const parts = dateTag.description.split(' ');
    if (parts.length === 2) {
      const dateParts = parts[0].replace(/:/g, '-');
      dateTaken = `${dateParts}T${parts[1]}`;
    } else {
      dateTaken = dateTag.description;
    }
  }

  return {
    dateTaken,
    cameraModel: tags['Model']?.description,
    latitude: tags['GPSLatitude']?.description as unknown as number,
    longitude: tags['GPSLongitude']?.description as unknown as number,
    originalWidth: tags['ImageWidth']?.value as number,
    originalHeight: tags['ImageHeight']?.value as number,
    software: tags['Software']?.description
  };
}
