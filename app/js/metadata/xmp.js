import Uint8Reader from "./uint8reader";

export const NS_XMP = "http://ns.adobe.com/xap/1.0/";
const NS_RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const NS_XMLNS = "http://www.w3.org/2000/xmlns/";

const RDF_DESCRIPTION = "Description";
const RDF_SEQ = "Seq";
const RDF_BAG = "Bag";
const RDF_ALT = "Alt";
const RDF_LI = "li";

const BOM_UTF16BE = 0xFEFF;
const BOM_UTF16LE = 0xFFFE;
const BOM_UTF8 = 0xEFBBBF;

const PROP_HIERARCHICAL_TAGS = "http://ns.adobe.com/lightroom/1.0/hierarchicalSubject";
const PROP_TAGS = "http://purl.org/dc/elements/1.1/subject";
const PROP_DATE = "http://ns.adobe.com/xap/1.0/CreateDate";

export class XMPParser extends Uint8Reader {
  constructor(data, metadata){
    super(data);
    this.metadata = metadata;
    this.graph = {};
  }

  parseContainer(container, list) {
    for (let child of container.children) {
      if (child.namespaceURI == NS_RDF && child.localName == RDF_LI) {
        let next = child.firstElementChild;
        if (child.getAttributeNS(NS_RDF, "parseType") == "Resource") {
          let value = {};
          list.push(value);
          this.parseDescription(child, value);
        } else if (child.children.length == 1 && next.namespaceURI == NS_RDF && next.localName == RDF_DESCRIPTION) {
          let value = {};
          list.push(value);
          this.parseDescription(next, value);
        } else if (child.children.length == 0) {
          list.push(child.textContent);
        } else {
          console.warn("Complex list item found in RDF.");
        }
      } else {
        console.warn("Unexpected node in RDF container.", child.localName);
      }
    }
  }

  parseDescription(element, parent) {
    for (let attribute of element.attributes) {
      if (attribute.namespaceURI == NS_RDF || attribute.namespaceURI == NS_XMLNS) {
        continue;
      }

      parent[`${attribute.namespaceURI}${attribute.localName}`] = attribute.value;
    }

    for (let child of element.children) {
      let property = `${child.namespaceURI}${child.localName}`;
      let next = child.firstElementChild;
      if (child.children.length == 1 && next.namespaceURI == NS_RDF) {
        if (next.localName == RDF_DESCRIPTION) {
          parent[property] = {};
          this.parseDescription(next, parent[property]);
        } else if (next.localName == RDF_SEQ || next.localName == RDF_BAG || next.localName == RDF_ALT) {
          parent[property] = [];
          this.parseContainer(next, parent[property]);
        } else {
          console.warn("Unexpected RDF type in graph.", next.localName);
        }
      } else if (child.children.length == 0) {
        parent[property] = child.textContent;
      } else if (child.getAttributeNS(NS_RDF, "parseType") == "Resource") {
        parent[property] = {};
        this.parseDescription(child, parent[property]);
      } else {
        console.warn("Unexpected children in RDF Description.");
      }
    }
  }

  parseRDF(element, parent) {
    for (let child of element.children) {
      if (child.namespaceURI == NS_RDF && child.localName == RDF_DESCRIPTION) {
        let about = child.getAttributeNS(NS_RDF, "about");
        if (about) {
          console.warn("Unexpected RDF Description node in document.");
          continue;
        }

        this.parseDescription(child, parent);
      }
    }
  }

  parse() {
    this.offset += NS_XMP.length + 1;

    let bom = this.read16(true);
    let encoding = "utf-8";
    if (bom == BOM_UTF16BE) {
      encoding = "utf-16be";
      this.offset += 2;
    } else if (bom == BOM_UTF16LE) {
      encoding = "utf-16le";
      this.offset += 2;
    } else {
      bom = this.read(3, true);
      if (bom == BOM_UTF8) {
        this.offset += 3;
      }
    }

    let buffer = this.data.subarray(this.offset, this.data.length - this.offset);
    let decoder = new TextDecoder(encoding);
    let text = decoder.decode(buffer);

    let parser = new DOMParser();
    let doc = parser.parseFromString(text, "application/xml");

    let elements = Array.from(doc.querySelectorAll("RDF")).filter(e => e.namespaceURI == NS_RDF);
    for (let element of elements) {
      this.parseRDF(element, this.graph);
    }

    if (PROP_HIERARCHICAL_TAGS in this.graph) {
      this.metadata.hierarchicalTags = this.graph[PROP_HIERARCHICAL_TAGS];
    }

    if (PROP_TAGS in this.graph) {
      this.metadata.tags = this.graph[PROP_TAGS];
    }

    if (PROP_DATE in this.graph) {
      this.metadata.date = new Date(Date.parse(this.graph[PROP_DATE]));
    }
  }
}
