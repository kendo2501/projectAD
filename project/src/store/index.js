import { configureStore, combineReducers } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { persistReducer, persistStore } from "redux-persist";


import auth from "./slices/authSlice";
import student from "./slices/studentSlice";
import teacher from "./slices/teacherSlice";


const rootReducer = combineReducers({ auth, student, teacher });


const persistConfig = {
key: "root",
storage: AsyncStorage,
whitelist: ["auth"], // persist only auth
};


const persistedReducer = persistReducer(persistConfig, rootReducer);


export const store = configureStore({
reducer: persistedReducer,
middleware: (getDefault) => getDefault({ serializableCheck: false }),
});


export const persistor = persistStore(store);