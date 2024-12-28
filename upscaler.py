from PIL import Image, ImageFilter

def iterative_upscale(image, scale_factor=3.0, steps=2):
    """
    Upscale an image by 'scale_factor' in multiple steps
    using the LANCZOS resampling filter.
    """
    width, height = image.size
    step_factor = scale_factor ** (1 / steps)  # e.g., 3^(1/2) ~ 1.732 if steps=2
    
    upscaled = image
    for _ in range(steps):
        new_width = int(upscaled.width * step_factor)
        new_height = int(upscaled.height * step_factor)
        upscaled = upscaled.resize((new_width, new_height), Image.LANCZOS)
    return upscaled