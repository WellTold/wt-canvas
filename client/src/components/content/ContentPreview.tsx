interface ContentBlock {
  type: string;
  content: any;
}

interface ContentPreviewProps {
  title: string;
  metaDescription?: string;
  featuredImage?: string;
  content: ContentBlock[];
}

export function ContentPreview({ title, metaDescription, featuredImage, content }: ContentPreviewProps) {
  return (
    <div className="prose max-w-none">
      {/* Featured Image as Hero */}
      {featuredImage && (
        <div className="mb-8 -mx-6">
          <img 
            src={featuredImage} 
            alt={`Featured image for ${title}`}
            className="w-full h-64 md:h-96 object-cover rounded-lg shadow-lg"
          />
        </div>
      )}

      {/* Article Title as H1 */}
      <h1 className="text-3xl font-bold mb-6 border-b pb-4">{title}</h1>

      {/* Meta Description if available */}
      {metaDescription && (
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-8 border-l-4 border-blue-500">
          <p className="text-lg text-gray-700 dark:text-gray-300 italic leading-relaxed">
            {metaDescription}
          </p>
        </div>
      )}

      {/* Content blocks rendered cleanly */}
      {content && content.length > 0 ? (
        <div className="space-y-8">
          {content.map((block: ContentBlock, index: number) => (
            <div key={index}>
              {block.type === 'heading' && (
                <h2 className="text-2xl font-semibold mt-8 mb-4 text-gray-900 dark:text-gray-100">
                  {typeof block.content === 'string' 
                    ? block.content 
                    : block.content?.text || ''}
                </h2>
              )}
              {(block.type === 'paragraph' || block.type === 'text') && (
                <div className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6 text-lg">
                  {(() => {
                    const textContent = typeof block.content === 'string' 
                      ? block.content 
                      : block.content?.text || '';
                    
                    return textContent.split('\n').map((line: string, i: number) => (
                      <p key={i} className="mb-4">{line}</p>
                    ));
                  })()}
                </div>
              )}
              {block.type === 'list' && (
                <ul className="list-disc list-inside space-y-3 mb-8 text-lg">
                  {(Array.isArray(block.content) ? block.content : block.content?.items || []).map((listItem: string, i: number) => (
                    <li key={i} className="text-gray-700 dark:text-gray-300">{String(listItem)}</li>
                  ))}
                </ul>
              )}
              {block.type === 'quote' && (
                <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-6 py-4 my-8 bg-gray-50 dark:bg-gray-800 rounded-r-lg">
                  <p className="text-xl italic text-gray-800 dark:text-gray-200 leading-relaxed">
                    {(() => {
                      if (typeof block.content === 'string') return block.content;
                      if (block.content && typeof block.content === 'object' && 'text' in block.content) {
                        return String(block.content.text);
                      }
                      return String(block.content || '');
                    })()}
                  </p>
                  {(() => {
                    if (block.content && typeof block.content === 'object' && block.content.hasOwnProperty('author') && block.content.author) {
                      return (
                        <cite className="text-gray-600 dark:text-gray-400 font-medium block mt-2">
                          — {String(block.content.author)}
                        </cite>
                      );
                    }
                    return null;
                  })()}
                </blockquote>
              )}
              {block.type === 'image' && (
                <div className="my-8">
                  <img 
                    src={(() => {
                      if (block.content && typeof block.content === 'object' && block.content.hasOwnProperty('url')) {
                        return String(block.content.url);
                      }
                      return String(block.content || '');
                    })()} 
                    alt={(() => {
                      if (block.content && typeof block.content === 'object' && block.content.hasOwnProperty('alt')) {
                        return String(block.content.alt);
                      }
                      return title;
                    })()}
                    className="w-full max-w-2xl mx-auto rounded-lg shadow-lg"
                  />
                  {(() => {
                    if (block.content && typeof block.content === 'object' && block.content.hasOwnProperty('caption') && block.content.caption) {
                      return (
                        <p className="text-sm text-gray-600 dark:text-gray-400 text-center mt-2 italic">
                          {String(block.content.caption)}
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
              {block.type === 'cta' && (
                <div className="my-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-center">
                  <p className="text-lg text-blue-800 dark:text-blue-200 mb-4">
                    {(() => {
                      if (typeof block.content === 'string') return block.content;
                      if (block.content && typeof block.content === 'object' && block.content.hasOwnProperty('text')) {
                        return String(block.content.text);
                      }
                      return String(block.content || '');
                    })()}
                  </p>
                  <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
                    {(() => {
                      if (block.content && typeof block.content === 'object' && block.content.hasOwnProperty('buttonText')) {
                        return String(block.content.buttonText);
                      }
                      return "Learn More";
                    })()}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="text-lg">No content blocks available</p>
        </div>
      )}
    </div>
  );
}