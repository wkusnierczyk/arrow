// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

const {
    metadataFiles, packageJSONFields,
    mainExport, npmPkgName, npmOrgName,
    targetDir, packageName, observableFromStreams
} = require('./util');

const gulp = require('gulp');
const { memoizeTask } = require('./memoize-task');
const { Observable, ReplaySubject } = require('rxjs');
const gulpJsonTransform = require('gulp-json-transform');

const packageTask = ((cache) => memoizeTask(cache, function bundle(target, format) {
    const out = targetDir(target, format);
    const jsonTransform = gulpJsonTransform(target === npmPkgName ? createMainPackageJson(target, format) :
                                            target === `ts`       ? createTypeScriptPackageJson(target, format)
                                                                  : createScopedPackageJSON(target, format),
                                            2);
    return Observable.forkJoin(
      observableFromStreams(gulp.src(metadataFiles), gulp.dest(out)), // copy metadata files
      observableFromStreams(gulp.src(`package.json`), jsonTransform, gulp.dest(out)) // write packageJSONs
    ).publish(new ReplaySubject()).refCount();
}))({});

module.exports = packageTask;
module.exports.packageTask = packageTask;

const createMainPackageJson = (target, format) => (orig) => ({
    ...createTypeScriptPackageJson(target, format)(orig),
    name: npmPkgName,
    main: mainExport,
    module: `${mainExport}.mjs`,
    browser: `${mainExport}.es5.min.js`,
    [`browser:es2015`]: `${mainExport}.es2015.min.js`,
    [`@std/esm`]: { esm: `mjs` }
});
  
const createTypeScriptPackageJson = (target, format) => (orig) => ({
    ...createScopedPackageJSON(target, format)(orig),
    main: `${mainExport}.ts`, types: `${mainExport}.ts`,
    dependencies: {
        '@types/flatbuffers': '*',
        '@types/node': '*',
        ...orig.dependencies
    }
});
  
const createScopedPackageJSON = (target, format) => (({ name, ...orig }) =>
    conditionallyAddStandardESMEntry(target, format)(
      packageJSONFields.reduce(
        (xs, key) => ({ ...xs, [key]: xs[key] || orig[key] }),
        { name: `${npmOrgName}/${packageName(target, format)}`,
          version: undefined, main: `${mainExport}.js`, types: `${mainExport}.d.ts`,
          browser: undefined, [`browser:es2015`]: undefined, module: undefined, [`@std/esm`]: undefined }
      )
    )
);
  
const conditionallyAddStandardESMEntry = (target, format) => (packageJSON) => (
    format !== `esm`
      ? packageJSON
      : { ...packageJSON, [`@std/esm`]: { esm: `js` } }
);
  