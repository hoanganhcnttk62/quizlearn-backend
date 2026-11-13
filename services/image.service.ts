import { Image } from '../models/image';
import { User } from '../models/user';
import { uploadFile, deleteFile } from '../utils/cloudinary';
import ErrorHandler from '../utils/errorHandler';

interface MinIOUploadResult {
  publicId: string;
  url: string;
}

export const updateProfileImage = async (
  userId: string,
  imageFile: { path: string }
): Promise<{ url: string; publicId: string }> => {
  try {
    // Upload to MinIO
    const result = await uploadFile(imageFile.path, 'profile_images');

    // Get the user's current image if exists
    const currentImage = await Image.findOne({
      where: { userId }
    });

    // If there's an existing image, delete it from MinIO
    if (currentImage) {
      await deleteFile(currentImage.publicId);
      await currentImage.destroy();
    }

    // Create new image record
    const newImage = await Image.create({
      url: result.url,
      publicId: result.publicId,
      userId
    });

    // Update user's avatar URL
    await User.update(
      { avatar: result.url },
      { where: { id: userId } }
    );

    return {
      url: result.url,
      publicId: result.publicId
    };
  } catch (error: any) {
    throw new ErrorHandler(error.message || 'Error updating profile image', 400);
  }
};

export const deleteProfileImage = async (userId: string): Promise<void> => {
  try {
    const image = await Image.findOne({
      where: { userId }
    });

    if (image) {
      // Delete from MinIO
      await deleteFile(image.publicId);
      
      // Delete from database
      await image.destroy();

      // Update user's avatar to empty string instead of null
      await User.update(
        { avatar: '' },
        { where: { id: userId } }
      );
    }
  } catch (error: any) {
    throw new ErrorHandler(error.message || 'Error deleting profile image', 400);
  }
};

export const getProfileImage = async (userId: string): Promise<Image | null> => {
  try {
    return await Image.findOne({
      where: { userId }
    });
  } catch (error: any) {
    throw new ErrorHandler(error.message || 'Error getting profile image', 400);
  }
}; 