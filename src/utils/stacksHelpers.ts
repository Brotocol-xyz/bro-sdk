export function deserializeAssetIdentifier(a: string):
  | undefined
  | {
      deployerAddress: string
      contractName: string
      fungibleTokenId?: string
    } {
  const step1Res = a.split(".")
  if (step1Res.length !== 2) return undefined

  const [deployerAddress, contractNameAndRest] = step1Res
  const step2Res = contractNameAndRest.split("::")

  if (step2Res.length > 1) {
    const [contractName, fungibleTokenId] = step2Res
    return { deployerAddress, contractName, fungibleTokenId }
  } else {
    const [contractName] = step2Res
    return { deployerAddress, contractName }
  }
}
