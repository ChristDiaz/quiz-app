import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { X } from 'lucide-react';

function QuestionImageLightbox({
  src,
  alt,
  imageClassName = '',
  wrapperClassName = '',
  buttonClassName = '',
}) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
    setIsLightboxOpen(false);
  }, [src]);

  useEffect(() => {
    if (!isLightboxOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsLightboxOpen(false);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLightboxOpen]);

  if (!src || hasImageError) {
    return null;
  }

  const openLightbox = () => setIsLightboxOpen(true);
  const closeLightbox = () => setIsLightboxOpen(false);

  return (
    <>
      <div className={wrapperClassName}>
        <button
          type="button"
          onClick={openLightbox}
          className={`block cursor-zoom-in rounded focus:outline-none focus:ring-2 focus:ring-[#2980b9] focus:ring-offset-2 ${buttonClassName}`}
          aria-label="Open image preview"
        >
          <img
            src={src}
            alt={alt}
            className={imageClassName}
            loading="lazy"
            onError={() => setHasImageError(true)}
          />
        </button>
      </div>

      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={alt ? `Expanded preview for ${alt}` : 'Expanded image preview'}
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute right-4 top-4 inline-flex items-center justify-center rounded-full bg-white/15 p-2 text-white hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
            aria-label="Close image preview"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={src}
            alt={alt}
            className="max-h-[90vh] max-w-[90vw] rounded-md object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

QuestionImageLightbox.propTypes = {
  src: PropTypes.string,
  alt: PropTypes.string.isRequired,
  imageClassName: PropTypes.string,
  wrapperClassName: PropTypes.string,
  buttonClassName: PropTypes.string,
};

QuestionImageLightbox.defaultProps = {
  src: '',
  imageClassName: '',
  wrapperClassName: '',
  buttonClassName: '',
};

export default QuestionImageLightbox;
