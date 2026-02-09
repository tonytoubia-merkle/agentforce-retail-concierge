import { useState } from 'react';

const NO_IMAGE_PLACEHOLDER = '/assets/products/no-image.png';

interface ProductImageProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * Product image with automatic fallback to placeholder on error.
 */
export const ProductImage: React.FC<ProductImageProps> = ({ src, alt, className = '' }) => {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(NO_IMAGE_PLACEHOLDER);
    }
  };

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      onError={handleError}
    />
  );
};

export default ProductImage;
