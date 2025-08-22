import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";


import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import StudentScreen from "../screens/StudentScreen";
import TeacherScreen from "../screens/TeacherScreen";


const Stack = createNativeStackNavigator();


export default function RootNavigator() {
return (
<NavigationContainer>
<Stack.Navigator>
<Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
<Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
<Stack.Screen name="StudentScreen" component={StudentScreen} options={{ headerShown: false }} />
<Stack.Screen name="TeacherScreen" component={TeacherScreen} options={{ headerShown: false }} />
</Stack.Navigator>
</NavigationContainer>
);
}