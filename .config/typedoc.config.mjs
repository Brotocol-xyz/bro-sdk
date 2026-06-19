import pkgInfo from "../package.json" with { type: "json" }
import path from "node:path"

const entryPoints = Object.keys(pkgInfo.exports).map(i => {
  const exportEndpoint = i === "." ? "./index" : i
  const exportEndpointFilePath = path.join("../src", exportEndpoint) + ".ts"
  return exportEndpointFilePath
})

/** @type {Partial<import('typedoc').TypeDocOptions>} */
const config = {
  entryPoints: entryPoints,
  out: "../generated/docs",
}

export default config
