import JSZip from 'jszip';
export async function createPresentation() {
  const zip = new JSZip();
  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
      <p:presentation xmlns:p="p" xmlns:r="r">
        <p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>
        <p:sldSz cx="12192000" cy="6858000"/>
      </p:presentation>`,
  );
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<Relationships><Relationship Id="rId1" Target="slides/slide1.xml"/></Relationships>`,
  );
  zip.file(
    'ppt/slides/slide1.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld xmlns:p="p" xmlns:a="a" xmlns:r="r">
        <p:cSld><p:spTree>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="Title"/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="1000000" y="800000"/><a:ext cx="8000000" cy="1000000"/></a:xfrm><a:noFill/></p:spPr>
            <p:txBody><a:bodyPr/><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="3200" b="1"><a:solidFill><a:srgbClr val="112233"/></a:solidFill><a:latin typeface="Aptos Display"/></a:rPr><a:t>Visible title</a:t></a:r></a:p></p:txBody>
          </p:sp>
          <p:pic>
            <p:nvPicPr><p:cNvPr id="3" name="Photo"/></p:nvPicPr>
            <p:blipFill><a:blip r:embed="rImg"/></p:blipFill>
            <p:spPr><a:xfrm><a:off x="2000000" y="2500000"/><a:ext cx="2000000" cy="1500000"/></a:xfrm></p:spPr>
          </p:pic>
        </p:spTree></p:cSld>
      </p:sld>`,
  );
  zip.file(
    'ppt/slides/_rels/slide1.xml.rels',
    `<Relationships><Relationship Id="rImg" Target="../media/image1.png"/></Relationships>`,
  );
  zip.file(
    'ppt/media/image1.png',
    Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  zip.file(
    '[Content_Types].xml',
    '<Types><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>',
  );
  return zip.generateAsync({ type: 'arraybuffer' });
}

async function createGradientPresentation() {
  const zip = await JSZip.loadAsync(await createPresentation());
  const slide = await zip.file('ppt/slides/slide1.xml')!.async('text');
  zip.file(
    'ppt/slides/slide1.xml',
    slide.replace(
      '<p:cSld><p:spTree>',
      '<p:cSld><p:bg><p:bgPr><a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="112233"/></a:gs><a:gs pos="100000"><a:srgbClr val="ddeeff"/></a:gs></a:gsLst><a:lin ang="0"/></a:gradFill></p:bgPr></p:bg><p:spTree>',
    ),
  );
  return zip.generateAsync({ type: 'arraybuffer' });
}

async function createThreeSlidePresentation() {
  const zip = await JSZip.loadAsync(await createPresentation());
  const firstSlide = await zip.file('ppt/slides/slide1.xml')!.async('text');
  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
      <p:presentation xmlns:p="p" xmlns:r="r">
        <p:sldIdLst>
          <p:sldId id="256" r:id="rId1"/>
          <p:sldId id="257" r:id="rId2"/>
          <p:sldId id="258" r:id="rId3"/>
        </p:sldIdLst>
        <p:sldSz cx="12192000" cy="6858000"/>
      </p:presentation>`,
  );
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    '<Relationships><Relationship Id="rId1" Target="slides/slide1.xml"/><Relationship Id="rId2" Target="slides/slide2.xml"/><Relationship Id="rId3" Target="slides/slide3.xml"/></Relationships>',
  );
  zip.file(
    'ppt/slides/slide2.xml',
    firstSlide.replace('Visible title', 'Second slide'),
  );
  zip.file(
    'ppt/slides/slide3.xml',
    firstSlide.replace('Visible title', 'Third slide'),
  );
  zip.file(
    '[Content_Types].xml',
    '<Types><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slides/slide3.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>',
  );
  return zip.generateAsync({ type: 'arraybuffer' });
}
