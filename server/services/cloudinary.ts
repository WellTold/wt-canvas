import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Debug configuration
console.log('Cloudinary Config Debug:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Missing',
  api_secret: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Missing',
});

export interface CloudinaryAsset {
  public_id: string;
  secure_url: string;
  url: string;
  display_name: string;
  format: string;
  resource_type: string;
  type: string;
  bytes: number;
  width?: number;
  height?: number;
  created_at: string;
  folder?: string;
  tags: string[];
}

export interface CloudinaryFolder {
  name: string;
  path: string;
}

export async function getCloudinaryAssets(
  folder?: string, 
  resourceType: 'image' | 'video' | 'raw' | 'auto' = 'image',
  maxResults: number = 100
): Promise<CloudinaryAsset[]> {
  try {
    // Build search expression for folder filtering
    // If folder is specified, search for assets in that folder and all subfolders
    let searchExpression: string;
    if (folder) {
      // Use Cloudinary's folder syntax - folder:name/* includes all subfolders
      searchExpression = `folder:${folder}* AND resource_type:${resourceType}`;
    } else {
      searchExpression = `resource_type:${resourceType}`;
    }

    console.log(`Cloudinary search - folder: "${folder}", expression: "${searchExpression}"`);

    const result = await cloudinary.search
      .expression(searchExpression)
      .sort_by('created_at', 'desc')
      .max_results(maxResults)
      .execute();

    console.log(`Cloudinary search - found ${result.resources?.length || 0} assets`);
    if (result.resources?.length > 0) {
      console.log(`Sample asset folders:`, result.resources.slice(0, 3).map((r: any) => r.folder));
    }

    return result.resources.map((asset: any): CloudinaryAsset => ({
      public_id: asset.public_id,
      secure_url: asset.resource_type === 'image' ? getOptimizedImageUrl(asset.public_id) : asset.secure_url,
      url: asset.url,
      display_name: asset.display_name || asset.public_id.split('/').pop() || asset.public_id,
      format: asset.format,
      resource_type: asset.resource_type,
      type: asset.type,
      bytes: asset.bytes,
      width: asset.width,
      height: asset.height,
      created_at: asset.created_at,
      folder: asset.folder,
      tags: asset.tags || [],
    }));
  } catch (error) {
    console.error('Error fetching Cloudinary assets:', error);
    throw new Error('Failed to fetch Cloudinary assets');
  }
}

async function getAllFoldersRecursively(basePath: string = ''): Promise<CloudinaryFolder[]> {
  const allFolders: CloudinaryFolder[] = [];
  
  try {
    const result = basePath 
      ? await cloudinary.api.sub_folders(basePath)
      : await cloudinary.api.root_folders();
    
    for (const folder of result.folders) {
      allFolders.push({
        name: folder.name,
        path: folder.path,
      });
      
      // Recursively get subfolders
      try {
        const subfolders = await getAllFoldersRecursively(folder.path);
        allFolders.push(...subfolders);
      } catch (subError) {
        console.warn(`Could not fetch subfolders for ${folder.path}:`, subError);
      }
    }
  } catch (error) {
    console.warn(`Could not fetch folders for path "${basePath}":`, error);
  }
  
  return allFolders;
}

export async function getCloudinaryFolders(): Promise<CloudinaryFolder[]> {
  try {
    // Get all folders recursively starting from root
    const folders = await getAllFoldersRecursively();
    
    // Sort folders alphabetically by path
    return folders.sort((a, b) => a.path.localeCompare(b.path));
  } catch (error) {
    console.error('Error fetching Cloudinary folders:', error);
    
    // Fallback: try the aggregation approach
    try {
      const result = await cloudinary.search
        .expression('resource_type:image')
        .aggregate('folder')
        .max_results(500)
        .execute();

      const fallbackFolders: CloudinaryFolder[] = [];
      
      if (result.aggregations && result.aggregations.folder) {
        for (const [folderPath, count] of Object.entries(result.aggregations.folder)) {
          if (folderPath && folderPath !== '') {
            fallbackFolders.push({
              name: folderPath.split('/').pop() || folderPath,
              path: folderPath,
            });
          }
        }
      }
      
      return fallbackFolders.sort((a, b) => a.path.localeCompare(b.path));
    } catch (fallbackError) {
      console.error('Fallback folder fetch also failed:', fallbackError);
      throw new Error('Failed to fetch Cloudinary folders');
    }
  }
}

export async function searchCloudinaryAssets(
  query: string,
  resourceType: 'image' | 'video' | 'raw' | 'auto' = 'image',
  maxResults: number = 100
): Promise<CloudinaryAsset[]> {
  try {
    if (!query?.trim()) {
      return [];
    }

    // Split query into individual words for flexible matching
    const words = query.toLowerCase().trim().split(/\s+/).filter(word => word.length > 0);
    
    if (words.length === 0) {
      return [];
    }

    // Build a flexible search expression that matches any of the words
    // Search in public_id, filename, and tags
    const wordSearches = words.map(word => {
      // Use wildcard matching for partial matches
      return `(public_id:*${word}* OR filename:*${word}* OR tags:*${word}*)`;
    });

    // Combine all word searches with OR to find assets containing any of the words
    const searchExpression = `resource_type:${resourceType} AND (${wordSearches.join(' OR ')})`;

    console.log(`Cloudinary flexible search - query: "${query}", words: [${words.join(', ')}], expression: "${searchExpression}"`);

    const result = await cloudinary.search
      .expression(searchExpression)
      .sort_by('created_at', 'desc')
      .max_results(maxResults)
      .execute();

    console.log(`Cloudinary flexible search - found ${result.resources?.length || 0} assets`);

    // Score and sort results based on relevance
    const scoredResults = result.resources.map((asset: any) => {
      let score = 0;
      const assetText = [
        asset.public_id.toLowerCase(),
        asset.display_name?.toLowerCase() || '',
        asset.filename?.toLowerCase() || '',
        ...(asset.tags || []).map((tag: string) => tag.toLowerCase())
      ].join(' ');

      // Higher score for more word matches
      words.forEach(word => {
        const wordCount = (assetText.match(new RegExp(word, 'g')) || []).length;
        score += wordCount;
        
        // Bonus for exact matches in filename or public_id
        if (asset.public_id.toLowerCase().includes(word) || 
            (asset.filename && asset.filename.toLowerCase().includes(word))) {
          score += 2;
        }
      });

      return { asset, score };
    });

    // Sort by score (highest first) then by creation date
    scoredResults.sort((a: any, b: any) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      return new Date(b.asset.created_at).getTime() - new Date(a.asset.created_at).getTime();
    });

    // Remove duplicates based on public_id (same image, different formats)
    const uniqueAssets = new Map();
    scoredResults.forEach(({ asset }: any) => {
      const baseId = asset.public_id.replace(/\.[^/.]+$/, ''); // Remove extension
      if (!uniqueAssets.has(baseId) || uniqueAssets.get(baseId).score < asset.score) {
        uniqueAssets.set(baseId, { asset });
      }
    });

    return Array.from(uniqueAssets.values()).map(({ asset }: any): CloudinaryAsset => ({
      public_id: asset.public_id,
      secure_url: asset.resource_type === 'image' ? getOptimizedImageUrl(asset.public_id) : asset.secure_url,
      url: asset.url,
      display_name: asset.display_name || asset.public_id.split('/').pop() || asset.public_id,
      format: asset.format,
      resource_type: asset.resource_type,
      type: asset.type,
      bytes: asset.bytes,
      width: asset.width,
      height: asset.height,
      created_at: asset.created_at,
      folder: asset.folder,
      tags: asset.tags || [],
    }));
  } catch (error) {
    console.error('Error searching Cloudinary assets:', error);
    throw new Error('Failed to search Cloudinary assets');
  }
}

export function getOptimizedImageUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    crop?: string;
    quality?: string | number;
    format?: string;
    responsive?: boolean;
    gravity?: string;
    [key: string]: any; // Allow additional Cloudinary options
  } = {}
): string {
  const optimizations = {
    // Auto optimization features
    fetch_format: 'auto', // Automatically deliver best format (WebP, AVIF when supported)
    quality: options.quality || 'auto:best', // Smart quality optimization
    flags: 'progressive', // Progressive JPEG loading
    
    // Responsive images
    ...(options.responsive && {
      responsive: true,
      responsive_breakpoints: [
        { max_width: 1920, bytes_step: 20000, min_width: 1000 },
        { max_width: 1000, bytes_step: 20000, min_width: 600 },
        { max_width: 600, bytes_step: 20000, min_width: 300 }
      ]
    }),
    
    // Custom options override defaults
    ...options,
    secure: true,
  };

  return cloudinary.url(publicId, optimizations);
}

// Generate multiple optimized variants for responsive images
export function getResponsiveImageUrls(
  publicId: string,
  baseOptions: {
    crop?: string;
    quality?: string | number;
    format?: string;
  } = {}
): { [key: string]: string } {
  const breakpoints = [
    { name: 'mobile', width: 480 },
    { name: 'tablet', width: 768 },
    { name: 'desktop', width: 1200 },
    { name: 'large', width: 1920 }
  ];

  const urls: { [key: string]: string } = {};
  
  breakpoints.forEach(bp => {
    urls[bp.name] = getOptimizedImageUrl(publicId, {
      width: bp.width,
      crop: 'fill',
      ...baseOptions
    });
  });

  return urls;
}

// Auto-generate different image sizes for blog content
export function getBlogImageVariants(
  publicId: string,
  options: {
    quality?: string | number;
    format?: string;
  } = {}
): {
  thumbnail: string;
  small: string;
  medium: string;
  large: string;
  hero: string;
} {
  return {
    thumbnail: getOptimizedImageUrl(publicId, { width: 150, height: 150, crop: 'fill', ...options }),
    small: getOptimizedImageUrl(publicId, { width: 400, crop: 'scale', ...options }),
    medium: getOptimizedImageUrl(publicId, { width: 800, crop: 'scale', ...options }),
    large: getOptimizedImageUrl(publicId, { width: 1200, crop: 'scale', ...options }),
    hero: getOptimizedImageUrl(publicId, { width: 1920, height: 800, crop: 'fill', gravity: 'auto', ...options })
  };
}