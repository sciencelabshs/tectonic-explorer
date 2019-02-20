import Model from '../../js/plates-model/model'

describe('Tectonic Explorer model', () => {
  let modelImgData = null

  beforeAll(done => {
    global.getModelImage('testModel.png', imgData => {
      modelImgData = imgData
      done()
    })
  })

  it('should be initialized correctly using image data', () => {
    const initFunc = jest.fn()
    const model = new Model(modelImgData, initFunc)
    expect(model.plates.length).toEqual(3)
    expect(initFunc).toHaveBeenCalled()
    expect(model.time).toEqual(0)
    expect(model.stepIdx).toEqual(0)
    expect(model.kineticEnergy).toEqual(0)
  })
})
