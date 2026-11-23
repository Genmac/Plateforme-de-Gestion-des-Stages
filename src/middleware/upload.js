const multer = require('multer');
const path = require('path');

// Configuration du stockage local dans le dossier /uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// Vérification stricte du type MIME côté serveur
const fileFilter = (req, file, cb) => {
  const typesMimeAutorises = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  if (typesMimeAutorises.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé. Seuls les fichiers PDF et les images (JPEG, PNG, WEBP) sont acceptés.'), false);
  }
};

// Configuration finale de Multer (limite de taille : 10 Mo)
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 Mo en octets
  },
  fileFilter: fileFilter
});

module.exports = upload;