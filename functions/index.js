const functions         = require("firebase-functions");
const { tmpdir }        = require("os");
const { Storage }       = require("@google-cloud/storage");
const { dirname, join } = require("path");
const sharp             = require("sharp");
const fs                = require("fs-extra");
const gcs               = new Storage();

exports.resizeImg = functions
                  .runWith({ memory: "2GB", timeoutSeconds: 120 })
                  .storage
                  .object()
                  .onFinalize(async (object) => {
  const bucket    = gcs.bucket(object.bucket);
  const filePath  = object.name;
  const fileName  = filePath.split("/").pop();
  const bucketDir = dirname(filePath);

  const workingDir  = join(tmpdir(), "resize");
  const tmpFilePath = join(workingDir, fileName);

  console.log(`Got ${fileName} file`);

  if (fileName.includes("@s_") || !object.contentType.includes("image")) {
    console.log(`Already resized. Exiting function`);
    return false;
  }

  await fs.ensureDir(workingDir);
  await bucket.file(filePath).download({ destination: tmpFilePath });

  const sizes = [ 1920, 720, 100 ];

  const uploadPromises = sizes.map(async (size) => {

    console.log(`Resizing ${fileName} at size ${size}`);

    const ext        = fileName.split('.').pop();
    const imgName    = fileName.replace(`.${ext}`, "");
    const newImgName = `${imgName}@s_${size}.${ext}`;
    const imgPath    = join(workingDir, newImgName);
    await sharp(tmpFilePath).resize({ width: size }).toFile(imgPath);

    console.log(`Just resized ${newImgName} at size ${size}`);

    return bucket.upload(imgPath, {
      destination: join(bucketDir, newImgName)
    });

  });

  await Promise.all(uploadPromises);

  return fs.remove(workingDir);

});
