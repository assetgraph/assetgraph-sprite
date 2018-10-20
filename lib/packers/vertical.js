exports.pack = imageInfos => {
  let previousBottomPadding = 0;
  const packingData = {
    width: 0,
    height: 0,
    imageInfos: []
  };

  for (const existingImageInfo of imageInfos) {
    const imageInfo = { ...existingImageInfo };
    packingData.height += Math.max(previousBottomPadding, imageInfo.padding[0]);
    imageInfo.y = packingData.height;
    imageInfo.x = 0;
    packingData.height += imageInfo.height;
    previousBottomPadding = imageInfo.padding[2];
    packingData.width = Math.max(packingData.width, imageInfo.width);
    packingData.imageInfos.push(imageInfo);
  }
  return packingData;
};
