import { pipe } from "fp-ts/function"
import * as TE from "fp-ts/lib/TaskEither"
import * as E from "fp-ts/lib/Either"

function Promise_all<T>(promises: Promise<T>[]) {
  const result = promises.map((promise) =>
    TE.tryCatch(
      () =>
        Promise.resolve(promise)
          .then((result) => result)
          .catch((err) => Promise.reject(err)),
      (error) => new Error(`${error}`)
    )
  )
  return TE.sequenceArray(result)()
}

Promise_all<string[]>([])
  .then((array) =>
    pipe(
      array,
      E.fold(
        (err) => `We should not get here :${err}`,
        (array) => `This should be [1, 2, 3]: ${JSON.stringify(array)}`
      )
    )
  )
  .then(console.log)

function soon<T>(val: T) {
  return new Promise<T>((resolve) => {
    setTimeout(() => resolve(val), Math.random() * 500)
  })
}
Promise_all<number>([soon(1), soon(2), soon(3)])
  .then((array) =>
    pipe(
      array,
      E.fold(
        (err) => `We should not get here :${err}`,
        (array) => `This should be [1, 2, 3]: ${JSON.stringify(array)}`
      )
    )
  )
  .then(console.log)

Promise_all([soon(1), Promise.reject("X"), soon(3)])
  .then((array) =>
    pipe(
      array,
      E.fold(
        (err) => (err.message !== "X" ? `"Unexpected failure:", ${err}` : `${err}`),
        (res) => `${JSON.stringify(res)}`
      )
    )
  )
  .then(console.log)
