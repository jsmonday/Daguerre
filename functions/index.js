const functions        = require("firebase-functions");
const Storage          = require("@google-cloud/storage");
const { tmpDir, join } = require("os");
const { dirname }      = require("path");
const sharp            = require("sharp");
const fs               = require("fs-extra");

const resizeImg = functions.storage.object().onFinalize(async (object) => {
  const bucket    = object.bucket;
  const filePath  = object.name;
  const fileName  = filePath.split("/").pop();
  const bucketDir = dirname(filePath);

  const workingDir  = join(tmpDir(), "resize");
  const tmpFilePath = join(workingDir, "source.png");

  if (fileName.includes("r@") || !object.contentType.includes("image")) {
    console.log(`Exiting function`);
    return false;
  }

  await fs.ensureDir(workingDir);
  await bucket.file(filePath).download({ destination: tmpFilePath });

  const sizes = [ 1920, 720, 100 ];

  const uploadPromises = sizes.map(async (size) => {
    const imgName = `${fileName}@${size}`;
    const imgPath = join(workingDir, imgName);
    await sharp(tmpFilePath).resize({ width: size }).toFile(imgPath);

    return bucket.upload(imgPath, {
      destination: join(bucketDir, imgName)
    });
  });

  await Promise.all(uploadPromises);

  return fs.remove(workingDir);

});

module.exports = resizeImg