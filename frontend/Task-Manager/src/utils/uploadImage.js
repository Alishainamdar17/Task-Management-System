import axiosInstance from './axiosInstance';

// Upload file to backend /api/upload endpoint. The backend expects field name `file` and returns { imageUrl }
const uploadImage = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await axiosInstance.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (err) {
    console.error('[uploadImage] error', err);
    throw err;
  }
};

export default uploadImage;
