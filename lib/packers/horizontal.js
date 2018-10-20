exports.pack = imageInfos => {
  let previousRightPadding = 0;
  const packingData = {
    width: 0,
    height: 0,
    imageInfos: []
  };
  for (const existingImageInfo of imageInfos) {
    const imageInfo = { ...existingImageInfo };
    packingData.width += Math.max(previousRightPadding, imageInfo.padding[3]);
    imageInfo.x = packingData.width;
    imageInfo.y = 0;
    packingData.width += imageInfo.width;
    previousRightPadding = imageInfo.padding[1];
    packingData.height = Math.max(packingData.height, imageInfo.height);
    packingData.imageInfos.push(imageInfo);
  }
  return packingData;
};
