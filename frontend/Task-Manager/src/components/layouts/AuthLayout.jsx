import React from 'react'
import UI_IMG from "../../assets/images/bg-img1.jpg"


const AuthLayout = ({children}) => {
  return <div className='flex'>
 <div className="w-screen h-screen md:w-[60vw] px-12 pt-8 pb-12">
  <h2 className='text-3xl font-bold text-black'>Task Manager</h2>
  
  {children}
 </div>

  <div className='hidden md:flex w-[40vw] h-screen item-center justify-center bg-gray-200'>
  <img src = {UI_IMG} className='' />
  </div>
  </div>
};

export default AuthLayout
