const packers = ['./horizontal', './vertical', './jimScott'].map(require);

exports.pack = imageInfos => {
  let bestPacking;
  for (const packer of packers) {
    let packing;
    try {
      packing = packer.pack(imageInfos);
    } catch (e) {
      // The Jim Scott packer doesn't support sprite padding, just skip to the next packer if we get an exception.
      continue;
    }
    if (
      !bestPacking ||
      packing.width * packing.height < bestPacking.width * bestPacking.height
    ) {
      bestPacking = packing;
    }
  }
  return bestPacking;
};
